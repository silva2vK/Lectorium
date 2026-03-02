import fs from 'fs';
import path from 'path';

function fixImportsInDir(dir: string, depth: number) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fixImportsInDir(fullPath, depth + 1);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let relativePath = '';
      if (depth === 1) relativePath = './shared/Icon';
      else if (depth === 2) {
        if (dir.endsWith('shared')) relativePath = './Icon';
        else relativePath = '../shared/Icon';
      }
      else if (depth === 3) relativePath = '../../shared/Icon';
      else if (depth === 4) relativePath = '../../../shared/Icon';

      const regex = /import\s+\{\s*Icon(?:,\s*IconName)?\s*\}\s+from\s+['"](?:\.\.\/)*src\/components\/shared\/Icon['"];/g;
      const regex2 = /import\s+\{\s*IconName(?:,\s*Icon)?\s*\}\s+from\s+['"](?:\.\.\/)*src\/components\/shared\/Icon['"];/g;
      
      let changed = false;
      content = content.replace(regex, (match) => {
        changed = true;
        if (match.includes('IconName')) {
          return `import { Icon, IconName } from '${relativePath}';`;
        }
        return `import { Icon } from '${relativePath}';`;
      });
      content = content.replace(regex2, (match) => {
        changed = true;
        if (match.includes('Icon')) {
          return `import { Icon, IconName } from '${relativePath}';`;
        }
        return `import { IconName } from '${relativePath}';`;
      });

      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Fixed ${fullPath}`);
      }
    }
  }
}

fixImportsInDir('./components', 1);
