export const EMPLOYEE_PHOTOS_BUCKET = "employee-photos";

export function buildEmployeePhotoPath(employeeId: string): string {
  return `${EMPLOYEE_PHOTOS_BUCKET}/${employeeId}.jpg`;
}

export function getEmployeePhotoObjectKey(path: string): string {
  if (path.startsWith(`${EMPLOYEE_PHOTOS_BUCKET}/`)) {
    return path;
  }

  return buildEmployeePhotoPath(path);
}
