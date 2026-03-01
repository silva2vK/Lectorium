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

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  let newLines = [];
  let importedIcons = [];
  let hasLucideImport = false;
  let importLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('lucide-react')) {
      hasLucideImport = true;
      importLineIndex = i;
      const match = line.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/);
      if (match) {
        const icons = match[1].split(',').map(i => i.trim()).filter(i => i);
        for (const icon of icons) {
            const parts = icon.split(' as ');
            const originalName = parts[0].trim();
            const alias = parts[1] ? parts[1].trim() : originalName;
            importedIcons.push({ originalName, alias });
        }
      }
    } else {
      newLines.push(line);
    }
  }

  if (hasLucideImport) {
    // Determine relative path to components/shared/Icon.tsx
    const dir = path.dirname(file);
    let relativePath = path.relative(dir, 'src/components/shared/Icon');
    if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath;
    }
    // Fix windows paths if any
    relativePath = relativePath.replace(/\\\\/g, '/');

    // Add import for Icon
    const importStatement = "import { Icon } from '" + relativePath + "';";
    
    if (importLineIndex !== -1) {
        newLines.splice(importLineIndex, 0, importStatement);
    } else {
        newLines.unshift(importStatement);
    }

    let newContent = newLines.join('\n');

    // Replace <IconName ...> with <Icon name="OriginalName" ...>
    for (const { originalName, alias } of importedIcons) {
        // Regex to match <Alias ... or <Alias> or </Alias>
        const openRegex = new RegExp("<" + alias + "(\\\\s|>)", 'g');
        newContent = newContent.replace(openRegex, '<Icon name="' + originalName + '"$1');
        
        const closeRegex = new RegExp("</" + alias + ">", 'g');
        newContent = newContent.replace(closeRegex, "</Icon>");
    }

    fs.writeFileSync(file, newContent);
    console.log("Updated " + file);
  }
}
