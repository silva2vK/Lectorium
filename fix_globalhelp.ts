import fs from 'fs';

let content = fs.readFileSync('components/GlobalHelpModal.tsx', 'utf8');

if (!content.includes('lucide-react')) {
  content = content.replace(
    "import { Icon } from './shared/Icon';",
    "import { Icon } from './shared/Icon';\nimport { Cloud, AlertTriangle, CheckSquare, Globe, Shield, Zap, Layers, CheckCircle2, AlertCircle, Monitor, Wifi, HardDrive, Database, Save, CloudOff, History, RefreshCw, FileText, Layout, MessageSquare, Search, Wand2, BrainCircuit, Calculator, Quote, Table, Image, FilePlus, FolderPlus, Trash2, Download, ExternalLink, Lock, Key, Users, Info, Menu, Workflow, Pin, Clock, Server, File, FolderOpen, LifeBuoy, Upload, Signal, SignalHigh, Home, Folder, FolderInput, BarChart2, Square, Unlock, Terminal, Cpu, LogOut, User, Palette, ChevronDown, ChevronRight, DownloadCloud, LayoutGrid, LogIn, Wrench, Scale, Minimize, Contrast, UploadCloud, FileType, Copy, Scissors, Bold, Italic, Link, MessageSquarePlus, Share2, ArrowDown, ArrowUp, Replace, ReplaceAll, MessageSquareQuote, AlignLeft, AlignCenter, AlignRight, Settings2, Crop, RotateCw, Type, RefreshCcw, Hash, ChevronLeft, PenTool, ClipboardPaste, EyeOff, Activity, Edit2, HelpCircle, Book, Columns, LayoutTemplate, PanelTop, PanelBottom, Keyboard, Command, Settings, ArrowUpFromLine, Code, Sigma, RotateCcw, Gavel, Hourglass, MessageSquareText, PanelLeft, Droplets, Binary, Pen, Highlighter, ScrollText, SplitSquareHorizontal, MousePointer2, StickyNote, Eraser, MoveHorizontal, Minus, ZoomIn, Paintbrush, Languages, ListRestart, FileDiff, XCircle, FileWarning, WifiOff, Send, Bot, Podcast, Pipette, Chrome, Safari, Firefox, Apple, Smartphone, X } from 'lucide-react';"
  );
  fs.writeFileSync('components/GlobalHelpModal.tsx', content);
  console.log('Fixed GlobalHelpModal.tsx');
}
