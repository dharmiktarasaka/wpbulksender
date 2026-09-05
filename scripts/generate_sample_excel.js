const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const sampleData = [
  { Name: 'John Doe', Phone: '9876543210', Company: 'Tech Corp', Plan: 'Premium' },
  { Name: 'Sarah Connor', Phone: '9812345678', Company: 'Cyber Systems', Plan: 'Pro' },
  { Name: 'Michael Scott', Phone: '9123456789', Company: 'Dunder Mifflin', Plan: 'Enterprise' },
  { Name: 'Dwight Schrute', Phone: '9988776655', Company: 'Schrute Farms', Plan: 'Standard' },
  { Name: 'Jim Halpert', Phone: '9877665544', Company: 'Athlead', Plan: 'Premium' }
];

const worksheet = xlsx.utils.json_to_sheet(sampleData);
const workbook = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(workbook, worksheet, 'Customers');

const clientDir = path.join(__dirname, '..', 'client');
const outputPath = path.join(clientDir, 'sample_contacts.xlsx');

xlsx.writeFile(workbook, outputPath);
console.log('Sample contacts Excel file generated at:', outputPath);
