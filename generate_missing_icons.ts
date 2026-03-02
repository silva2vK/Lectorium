import * as lucide from 'lucide-react';

const missingIcons = [
  'Flame', 'Compass', 'Disc', 'Battery', 'Touchpad', 'MousePointerClick',
  'ArrowDownToLine', 'Strikethrough', 'Subscript', 'Superscript', 'Baseline',
  'AlignJustify', 'Grid3X3', 'ActivitySquare', 'FunctionSquare', 'Play',
  'Merge', 'Split', 'GripHorizontal', 'Indent'
];

let newData = '';
for (const name of missingIcons) {
  const icon = (lucide as any)[name];
  if (icon) {
    console.log(name, Object.keys(icon));
  } else {
    console.log(`Icon ${name} not found in lucide-react`);
  }
}

console.log(newData);
