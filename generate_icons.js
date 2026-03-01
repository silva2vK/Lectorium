import fs from 'fs';
import path from 'path';
import * as lucide from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

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
            const iconName = icon.split(' as ')[0].trim();
            icons.add(iconName);
        }
      }
    }
  }
}

let output = `import React from 'react';\n\n`;
output += `export type IconName = ${Array.from(icons).map(i => \`'\${i}'\`).join(' | ')};\n\n`;
output += `export const icons: Record<IconName, React.FC<React.SVGProps<SVGSVGElement>>> = {\n`;

for (const iconName of Array.from(icons).sort()) {
    const IconComponent = lucide[iconName];
    if (IconComponent) {
        // Render the icon to static markup to get the inner SVG paths
        const svgString = renderToStaticMarkup(React.createElement(IconComponent));
        // Extract the inner HTML of the SVG
        const innerMatch = svgString.match(/<svg[^>]*>(.*?)<\/svg>/);
        if (innerMatch) {
            const innerHtml = innerMatch[1];
            output += `  ${iconName}: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <g dangerouslySetInnerHTML={{ __html: \`${innerHtml}\` }} />
    </svg>
  ),\n`;
        }
    }
}

output += `};\n\n`;
output += `export const Icon = ({ name, className, ...props }: { name: IconName; className?: string } & React.SVGProps<SVGSVGElement>) => {
  const IconComponent = icons[name];
  if (!IconComponent) return null;
  return <IconComponent className={className} {...props} />;
};\n`;

fs.writeFileSync('components/shared/Icon.tsx', output);
console.log('Generated components/shared/Icon.tsx');
