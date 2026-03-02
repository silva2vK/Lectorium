import fs from 'fs';
import path from 'path';

function walk(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('./components');
let fixedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Find cases where } from 'lucide-react'; is preceded by a complete import statement.
  // Example:
  // import { BaseModal } from '../../shared/BaseModal';
  // } from 'lucide-react';
  
  // We can just look for `;\n} from 'lucide-react';` or `;\r\n} from 'lucide-react';`
  
  if (content.match(/;\r?\n} from 'lucide-react';/)) {
    // Calculate path to Icon
    const depth = file.split(path.sep).length - 1; // components/doc/modals/FootnoteModal.tsx -> 3
    // components/ -> 1 -> '../src/components/shared/Icon'
    // components/doc/ -> 2 -> '../../src/components/shared/Icon'
    // components/doc/modals/ -> 3 -> '../../../src/components/shared/Icon'
    
    let iconPath = '';
    if (depth === 1) iconPath = '../src/components/shared/Icon';
    else if (depth === 2) iconPath = '../../src/components/shared/Icon';
    else if (depth === 3) iconPath = '../../../src/components/shared/Icon';
    else if (depth === 4) iconPath = '../../../../src/components/shared/Icon';
    
    content = content.replace(/;\r?\n} from 'lucide-react';/g, `;\nimport { Icon } from '${iconPath}';`);
    fs.writeFileSync(file, content, 'utf8');
    fixedCount++;
    console.log(`Fixed bad replace in ${file}`);
  }
});

console.log(`Fixed ${fixedCount} files.`);
