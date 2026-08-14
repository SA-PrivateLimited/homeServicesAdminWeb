import { useState } from 'react';
import {Button} from 'sapvt-ltd-web-packages';
import type {
  QuestionnaireQuestion,
  QuestionType,
} from '../services/api/serviceCategoriesApi';

const TYPES: QuestionType[] = [
  'text',
  'number',
  'select',
  'multiselect',
  'boolean',
];

interface Props {
  value: QuestionnaireQuestion[];
  onChange: (next: QuestionnaireQuestion[]) => void;
}

function blankQuestion(): QuestionnaireQuestion {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    question: '',
    questionHi: '',
    type: 'text',
    required: false,
    options: [],
    optionsHi: [],
    placeholder: '',
    placeholderHi: '',
  };
}

export function QuestionnaireEditor({ value, onChange }: Props) {
  const [draft, setDraft] = useState<QuestionnaireQuestion>(blankQuestion());

  const updateAt = (index: number, patch: Partial<QuestionnaireQuestion>) => {
    onChange(value.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addQuestion = () => {
    if (!draft.question.trim()) return;
    const needsOptions = draft.type === 'select' || draft.type === 'multiselect';
    onChange([
      ...value,
      {
        ...draft,
        options: needsOptions ? draft.options ?? [] : undefined,
        optionsHi: needsOptions ? draft.optionsHi ?? [] : undefined,
      },
    ]);
    setDraft(blankQuestion());
  };

  return (
    <div className="questionnaire" data-testid="questionnaire-editor">
      <h3>Questionnaire</h3>
      <p className="muted">
        Questions shown to customers when booking this category (EN + optional HI).
      </p>

      {value.length === 0 ? (
        <p className="muted">No questions yet.</p>
      ) : (
        <ul className="question-list">
          {value.map((q, index) => (
            <li key={q.id} className="question-card">
              <div className="form-row">
                <label>
                  Question (EN)
                  <input
                    value={q.question}
                    onChange={(e) => updateAt(index, { question: e.target.value })}
                  />
                </label>
                <label>
                  Question (HI)
                  <input
                    value={q.questionHi || ''}
                    onChange={(e) =>
                      updateAt(index, { questionHi: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Type
                  <select
                    value={q.type}
                    onChange={(e) =>
                      updateAt(index, { type: e.target.value as QuestionType })
                    }
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) =>
                      updateAt(index, { required: e.target.checked })
                    }
                  />
                  Required
                </label>
                <Button variant="danger" onClick={() => removeAt(index)}
                >
                  Remove
                </Button>
              </div>
              {(q.type === 'select' || q.type === 'multiselect') && (
                <div className="form-row">
                  <label>
                    Options EN (comma-separated)
                    <input
                      value={(q.options || []).join(', ')}
                      onChange={(e) =>
                        updateAt(index, {
                          options: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                  <label>
                    Options HI (comma-separated)
                    <input
                      value={(q.optionsHi || []).join(', ')}
                      onChange={(e) =>
                        updateAt(index, {
                          optionsHi: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="question-card add-question">
        <h4>Add question</h4>
        <div className="form-row">
          <label>
            Question (EN)
            <input
              data-testid="new-question-input"
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            />
          </label>
          <label>
            Question (HI)
            <input
              value={draft.questionHi || ''}
              onChange={(e) =>
                setDraft({ ...draft, questionHi: e.target.value })
              }
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Type
            <select
              value={draft.type}
              onChange={(e) =>
                setDraft({ ...draft, type: e.target.value as QuestionType })
              }
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={draft.required}
              onChange={(e) =>
                setDraft({ ...draft, required: e.target.checked })
              }
            />
            Required
          </label>
        </div>
        {(draft.type === 'select' || draft.type === 'multiselect') && (
          <div className="form-row">
            <label>
              Options EN (comma-separated)
              <input
                value={(draft.options || []).join(', ')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    options: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          </div>
        )}
        <Button variant="primary" data-testid="add-question-btn" onClick={addQuestion}>
          Add question
        </Button>
      </div>
    </div>
  );
}
