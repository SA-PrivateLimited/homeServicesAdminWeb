declare module 'employeeManagement/EmployeeManagement' {
  import type {ComponentType} from 'react';

  export type EmployeeManagementProps = {
    getAccessToken: () => Promise<string>;
    companyId: string;
    apiBaseUrl?: string;
    displayName?: string;
    companyName?: string;
    permissions?: string[];
    locale?: string;
    basePath?: string;
  };

  const EmployeeManagement: ComponentType<EmployeeManagementProps>;
  export default EmployeeManagement;
}
