import fs from 'fs';
import path from 'path';

function findLucideImports(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findLucideImports(filePath, fileList);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('lucide-react')) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const files = findLucideImports('.');
const icons = new Set();

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('lucide-react')) {
      const match = line.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/);
      if (match) {
        const importedIcons = match[1].split(',').map(i => i.trim()).filter(i => i);
        for (const icon of importedIcons) {
            // Handle aliases like "Image as ImageIcon"
            const iconName = icon.split(' as ')[0].trim();
            icons.add(iconName);
        }
      }
    }
  }
}

console.log(Array.from(icons).sort().join(', '));
