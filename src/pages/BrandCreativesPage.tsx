import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Button, Dialog} from 'sapvt-ltd-web-packages';
import {
  SuccessBanner,
  type SuccessBannerContent,
} from '../components/SuccessBanner';
import {ApiError} from '../services/api/apiClient';
import {
  deleteBrandCreative,
  downloadBrandCreative,
  fetchCreativeBlob,
  listBrandCreatives,
  resolveCreativeUrl,
  uploadBrandCreative,
  type BrandCreative,
} from '../services/api/creativesApi';
import '../styles/pages.css';
import './BrandCreativesPage.css';

const IMAGE_NAME_RE = /\.(jpe?g|png|webp)$/i;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_BATCH = 100;

interface DirectoryReaderLike {
  readEntries: (
    success: (entries: FileSystemEntryLike[]) => void,
    error?: (err: DOMException) => void,
  ) => void;
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (
    success: (file: File) => void,
    error?: (err: DOMException) => void,
  ) => void;
  createReader?: () => DirectoryReaderLike;
}

function isCreativeImage(file: File): boolean {
  if (file.name.startsWith('.')) return false;
  if (IMAGE_NAME_RE.test(file.name)) return true;
  return IMAGE_TYPES.has(file.type.toLowerCase());
}

function uniqueImages(files: File[]): File[] {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const file of files) {
    if (!isCreativeImage(file)) continue;
    const key = `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }
  return out;
}

function readDirectoryEntries(
  reader: DirectoryReaderLike,
): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntryLike[] = [];
    const next = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(all);
            return;
          }
          all.push(...batch);
          next();
        },
        reject,
      );
    };
    next();
  });
}

async function filesFromEntry(entry: FileSystemEntryLike): Promise<File[]> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file!(resolve, reject);
    });
    return [file];
  }
  if (entry.isDirectory && entry.createReader) {
    const children = await readDirectoryEntries(entry.createReader());
    const nested = await Promise.all(children.map(filesFromEntry));
    return nested.flat();
  }
  return [];
}

async function filesFromDataTransfer(data: DataTransfer): Promise<File[]> {
  const items = Array.from(data.items || []);
  if (items.some((item) => typeof item.webkitGetAsEntry === 'function')) {
    const collected: File[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.() as FileSystemEntryLike | null;
      if (entry) {
        collected.push(...(await filesFromEntry(entry)));
      } else if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) collected.push(file);
      }
    }
    if (collected.length) return collected;
  }
  return Array.from(data.files || []);
}

function CreativeThumb({item}: {item: BrandCreative}) {
  const [src, setSrc] = useState(() => resolveCreativeUrl(item.url));
  const triedBlob = useRef(false);
  const blobUrl = useRef<string | null>(null);

  useEffect(() => {
    triedBlob.current = false;
    setSrc(resolveCreativeUrl(item.url));
  }, [item._id, item.url]);

  useEffect(() => {
    return () => {
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    };
  }, []);

  return (
    <img
      className="creatives-admin-thumb"
      src={src}
      alt={item.label || item.originalName}
      onError={() => {
        if (triedBlob.current) return;
        triedBlob.current = true;
        void fetchCreativeBlob(item._id)
          .then((blob) => {
            if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
            const next = URL.createObjectURL(blob);
            blobUrl.current = next;
            setSrc(next);
          })
          .catch(() => {});
      }}
    />
  );
}

export function BrandCreativesPage() {
  const {t} = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BrandCreative[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{done: number; total: number} | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BrandCreative | null>(null);
  const [successBanner, setSuccessBanner] =
    useState<SuccessBannerContent | null>(null);

  useEffect(() => {
    const input = folderRef.current;
    if (!input) return;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.multiple = true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listBrandCreatives());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadFiles = async (rawFiles: File[]) => {
    const images = uniqueImages(rawFiles).slice(0, MAX_BATCH);
    if (!images.length) {
      setError(t('creativesNoImages'));
      return;
    }
    setUploading(true);
    setError(null);
    setProgress({done: 0, total: images.length});
    const created: BrandCreative[] = [];
    const failures: string[] = [];
    try {
      for (let i = 0; i < images.length; i += 1) {
        const file = images[i];
        try {
          created.push(await uploadBrandCreative(file));
        } catch (err) {
          failures.push(
            `${file.name}: ${err instanceof Error ? err.message : t('errorGeneric')}`,
          );
        }
        setProgress({done: i + 1, total: images.length});
      }
      if (created.length) {
        setItems((prev) => [...created, ...prev]);
        setSuccessBanner({
          title: t('creativesUploadedTitle'),
          detail: t('creativesUploadedDetailCount', {count: created.length}),
        });
      }
      if (failures.length) {
        setError(
          t('creativesUploadPartial', {
            failed: failures.length,
            ok: created.length,
          }),
        );
      }
      if (rawFiles.length > MAX_BATCH) {
        setError(t('creativesUploadCapped', {max: MAX_BATCH}));
      }
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
      if (folderRef.current) folderRef.current.value = '';
    }
  };

  const onDownload = async (item: BrandCreative) => {
    setBusyId(item._id);
    setError(null);
    try {
      await downloadBrandCreative(
        item._id,
        item.originalName || item.label || 'akanso-creative.jpg',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  const onCopy = async (item: BrandCreative) => {
    try {
      await navigator.clipboard.writeText(resolveCreativeUrl(item.url) || item.url);
      setSuccessBanner({
        title: t('creativesCopiedTitle'),
        detail: item.url,
      });
    } catch {
      setError(t('creativesCopyFailed'));
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget._id);
    setError(null);
    try {
      await deleteBrandCreative(deleteTarget._id);
      setItems((prev) => prev.filter((row) => row._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="admin-page scale-baseline-80 creatives-admin-page"
      data-testid="brand-creatives-page">
      <header className="page-header">
        <h1>{t('creativesTitle')}</h1>
        <p>{t('creativesLead')}</p>
      </header>

      {successBanner ? (
        <SuccessBanner
          banner={successBanner}
          onDismiss={() => setSuccessBanner(null)}
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <section
        className={`panel creatives-admin-toolbar${dragOver ? ' is-dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void filesFromDataTransfer(e.dataTransfer).then((files) =>
            uploadFiles(files),
          );
        }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          hidden
          onChange={(e) =>
            void uploadFiles(Array.from(e.target.files || []))
          }
        />
        <input
          ref={folderRef}
          type="file"
          hidden
          onChange={(e) =>
            void uploadFiles(Array.from(e.target.files || []))
          }
        />
        <Button
          variant="primary"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}>
          {uploading && progress
            ? t('creativesUploadingProgress', progress)
            : t('creativesUpload')}
        </Button>
        <Button
          variant="ghost"
          disabled={uploading}
          onClick={() => folderRef.current?.click()}>
          {t('creativesUploadFolder')}
        </Button>
        <Button variant="ghost" disabled={loading || uploading} onClick={() => void load()}>
          {t('reload')}
        </Button>
        <p className="creatives-admin-drop-hint">{t('creativesDropHint')}</p>
      </section>

      {loading ? (
        <p>{t('loading')}</p>
      ) : items.length === 0 ? (
        <p className="creatives-admin-empty">{t('creativesEmpty')}</p>
      ) : (
        <ul className="creatives-admin-grid">
          {items.map((item) => (
            <li key={item._id} className="panel creatives-admin-card">
              <CreativeThumb item={item} />
              <p className="creatives-admin-name">
                {item.label || item.originalName || t('creativesUntitled')}
              </p>
              <div className="creatives-admin-actions">
                <Button
                  variant="primary"
                  disabled={busyId === item._id || uploading}
                  onClick={() => void onDownload(item)}>
                  {t('creativesDownload')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busyId === item._id}
                  onClick={() => void onCopy(item)}>
                  {t('creativesCopyLink')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busyId === item._id || uploading}
                  onClick={() => setDeleteTarget(item)}>
                  {t('delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleteTarget ? (
        <Dialog
          open
          onClose={() => setDeleteTarget(null)}
          title={t('creativesDeleteTitle')}>
          <p className="modal-lead">{t('creativesDeleteLead')}</p>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={busyId === deleteTarget._id}
              onClick={() => void onDelete()}>
              {t('delete')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
