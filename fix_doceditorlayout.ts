import fs from 'fs';

let content = fs.readFileSync('components/doc/DocEditorLayout.tsx', 'utf8');

if (!content.includes('lucide-react')) {
  content = content.replace(
    "import { Icon } from '../shared/Icon';",
    "import { Icon } from '../shared/Icon';\nimport { Loader2, Cloud, Sparkles, Users, Share2, Menu, ChevronLeft, ChevronRight, Lock, Globe, FileText, MessageSquare } from 'lucide-react';"
  );
  fs.writeFileSync('components/doc/DocEditorLayout.tsx', content);
  console.log('Fixed DocEditorLayout.tsx');
}
