import * as XLSX from 'xlsx';

export function exportToExcel(data, filename = 'export') {
  if (!Array.isArray(data) || data.length === 0) {
    alert('Δεν υπάρχουν δεδομένα για εξαγωγή');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Δεδομένα');

  XLSX.writeFile(
    workbook,
    `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`
  );
}