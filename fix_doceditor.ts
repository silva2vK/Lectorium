import fs from 'fs';

let content = fs.readFileSync('components/doc/DocEditor.tsx', 'utf8');

if (!content.includes('lucide-react')) {
  content = content.replace(
    "import { Icon } from '../shared/Icon';",
    "import { Icon } from '../shared/Icon';\nimport { Loader2, Cloud, Sparkles, Users, Share2, MessageSquare, Menu, Lock, Globe, FileText, ChevronLeft, ChevronRight } from 'lucide-react';"
  );
  fs.writeFileSync('components/doc/DocEditor.tsx', content);
  console.log('Fixed DocEditor.tsx');
}
