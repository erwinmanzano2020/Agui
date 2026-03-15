export const EMPLOYEE_PHOTOS_BUCKET = "employee-photos";

export type EmployeePhotoFormat = "jpg" | "png";

export function buildEmployeePhotoPath(employeeId: string, format: EmployeePhotoFormat = "jpg"): string {
  return `${EMPLOYEE_PHOTOS_BUCKET}/${employeeId}.${format}`;
}

export function getEmployeePhotoObjectKey(path: string): string {
  if (path.startsWith(`${EMPLOYEE_PHOTOS_BUCKET}/`)) {
    return path;
  }

  return buildEmployeePhotoPath(path);
}
