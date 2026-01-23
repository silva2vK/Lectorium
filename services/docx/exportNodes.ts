
import { 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  UnderlineType, 
  CommentReference,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType
} from "docx";
import { CommentData } from "../../components/doc/CommentsSidebar";

// --- HELPERS ---

// 1cm = 566.929 twips.
const sizeToTwips = (sizeStr: string | null): number => {
    if (!sizeStr) return 0;
    let val = 0;
    if (typeof sizeStr === 'number') val = sizeStr;
    else if (sizeStr.endsWith('pt')) val = parseFloat(sizeStr) * 20;
    else if (sizeStr.endsWith('px')) val = parseFloat(sizeStr) * 15;
    else val = parseFloat(sizeStr) * 15;
    
    return Math.round(val);
};

export const mapAlignment = (align: string): any => {
  switch (align) {
    case 'center': return AlignmentType.CENTER;
    case 'right': return AlignmentType.RIGHT;
    case 'justify': return AlignmentType.JUSTIFIED;
    default: return AlignmentType.LEFT;
  }
};

const sanitizeColor = (color: string | null | undefined): string | undefined => {
    if (!color || color === 'transparent' || color === 'auto') return undefined;
    return color.replace('#', '').toUpperCase();
};

// --- NODE PROCESSORS ---

const processTextNode = (node: any, comments: CommentData[] = []): (TextRun | CommentReference)[] => {
  const marks = node.marks || [];
  const isBold = marks.some((m: any) => m.type === 'bold');
  const isItalic = marks.some((m: any) => m.type === 'italic');
  const isUnderline = marks.some((m: any) => m.type === 'underline');
  const isStrike = marks.some((m: any) => m.type === 'strike');
  const isSubscript = marks.some((m: any) => m.type === 'subscript');
  const isSuperscript = marks.some((m: any) => m.type === 'superscript');
  
  const textStyle = marks.find((m: any) => m.type === 'textStyle');
  const highlight = marks.find((m: any) => m.type === 'highlight');
  
  let color = sanitizeColor(textStyle?.attrs?.color) || "000000";
  
  let size = 24; // Default 12pt
  if (textStyle?.attrs?.fontSize) {
      let val = parseFloat(textStyle.attrs.fontSize);
      if (textStyle.attrs.fontSize.includes('px')) val = val * 0.75; 
      if (!isNaN(val)) size = Math.round(val * 2);
  }

  let font = "Times New Roman";
  if (textStyle?.attrs?.fontFamily) {
      font = textStyle.attrs.fontFamily.replace(/['"]/g, '');
  }

  const commentMark = marks.find((m: any) => m.type === 'comment');
  
  const trOptions: any = {
    text: node.text,
    bold: isBold,
    italics: isItalic,
    underline: isUnderline ? { type: UnderlineType.SINGLE } : undefined,
    strike: isStrike,
    subScript: isSubscript,
    superScript: isSuperscript,
    color: color,
    size: size,
    font: font
  };

  if (highlight?.attrs?.color) {
      trOptions.highlight = sanitizeColor(highlight.attrs.color);
  }

  const tr = new TextRun(trOptions);

  if (commentMark) {
      const idStr = commentMark.attrs.commentId;
      const index = comments.findIndex(c => c.id === idStr);
      if (index !== -1) {
          const numericId = index + 1;
          return [tr, new CommentReference(numericId)];
      }
  }

  return [tr];
};

export const createDocxParagraph = (node: any, comments: CommentData[]): Paragraph => {
    const spacing: any = {};
    if (node.attrs?.marginBottom) spacing.after = sizeToTwips(node.attrs.marginBottom);
    if (node.attrs?.marginTop) spacing.before = sizeToTwips(node.attrs.marginTop);
    if (node.attrs?.lineHeight) {
        spacing.line = Math.round(parseFloat(node.attrs.lineHeight) * 240);
        spacing.lineRule = "auto";
    }

    const indent: any = {};
    if (node.attrs?.marginLeft) indent.left = sizeToTwips(node.attrs.marginLeft);
    if (node.attrs?.marginRight) indent.right = sizeToTwips(node.attrs.marginRight);
    if (node.attrs?.textIndent) indent.firstLine = sizeToTwips(node.attrs.textIndent);

    const paraOptions: any = {
        children: [],
        alignment: mapAlignment(node.attrs?.textAlign),
        spacing: spacing,
        indent: indent,
        keepNext: node.attrs?.keepWithNext,
        keepLines: node.attrs?.keepLinesTogether,
        pageBreakBefore: node.attrs?.pageBreakBefore,
        widowControl: node.attrs?.widowControl !== false,
    };

    const children = (node.content || []).flatMap((n: any) => {
        if (n.type === 'citation') {
            return [new TextRun({ text: n.attrs.label + ' ', bold: true, color: "555555" })];
        }
        if (n.type === 'text') {
            return processTextNode(n, comments);
        }
        return [];
    });
    paraOptions.children = children;

    if (node.type === 'heading') {
        paraOptions.heading = node.attrs?.level === 1 ? HeadingLevel.HEADING_1 :
                              node.attrs?.level === 2 ? HeadingLevel.HEADING_2 :
                              node.attrs?.level === 3 ? HeadingLevel.HEADING_3 :
                              HeadingLevel.HEADING_1;
        if (!spacing.after) paraOptions.spacing.after = 120;
        if (!spacing.before) paraOptions.spacing.before = 240;
    }

    if (node.attrs?.styleId) {
        paraOptions.style = node.attrs.styleId;
    }

    return new Paragraph(paraOptions);
};

export const createDocxTable = (node: any, comments: CommentData[]): Table => {
    const rows = (node.content || []).map((row: any) => {
        const cells = (row.content || []).map((cell: any) => {
            const cellChildren: Paragraph[] = [];
            (cell.content || []).forEach((cellNode: any) => {
                if (cellNode.type === 'paragraph' || cellNode.type === 'heading') {
                    cellChildren.push(createDocxParagraph(cellNode, comments));
                } else if (cellNode.type === 'image') {
                    cellChildren.push(new Paragraph({ children: [new TextRun("[Imagem]")] }));
                } else {
                    cellChildren.push(new Paragraph(cellNode.type || ''));
                }
            });

            if (cellChildren.length === 0) cellChildren.push(new Paragraph(""));

            const shading = cell.attrs?.backgroundColor 
                ? { fill: sanitizeColor(cell.attrs.backgroundColor), type: ShadingType.CLEAR, color: "auto" } 
                : undefined;

            return new TableCell({
                children: cellChildren,
                columnSpan: cell.attrs?.colspan || 1,
                rowSpan: cell.attrs?.rowspan || 1,
                shading: shading
            });
        });
        return new TableRow({ children: cells });
    });

    return new Table({
        rows: rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        }
    });
};

export const processList = (
    listNode: any, 
    level: number, 
    isOrdered: boolean, 
    comments: CommentData[], 
    docChildren: Paragraph[]
) => {
    const ref = isOrdered ? "default-ordered" : "default-bullet";

    if (listNode.content) {
        listNode.content.forEach((listItem: any) => {
            if (listItem.type === 'listItem' && listItem.content) {
                listItem.content.forEach((child: any) => {
                    if (child.type === 'paragraph') {
                        const children = (child.content || []).flatMap((n: any) => processTextNode(n, comments));
                        docChildren.push(new Paragraph({
                            children: children,
                            numbering: { reference: ref, level: level },
                            spacing: { after: 0 }
                        }));
                    } else if (child.type === 'bulletList' || child.type === 'orderedList') {
                        processList(child, level + 1, child.type === 'orderedList', comments, docChildren);
                    }
                });
            }
        });
    }
};
