export type MunicipalityOption = {
    value: string;
    label: string;
};
export type DepartmentOption = {
    value: string;
    label: string;
    municipalities: MunicipalityOption[];
};
export declare const DEPARTMENT_OPTIONS: DepartmentOption[];
