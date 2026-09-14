declare module 'employeeManagement/EmployeeManagement' {
  import type {ComponentType} from 'react';

  export type EmployeeManagementProps = {
    /** HR JWT comes from employee-management login inside the remote. */
    apiBaseUrl?: string;
    locale?: string;
    basePath?: string;
    companyName?: string;
  };

  const EmployeeManagement: ComponentType<EmployeeManagementProps>;
  export default EmployeeManagement;
}
