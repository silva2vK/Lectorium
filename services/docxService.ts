
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  ImageRun, 
  AlignmentType, 
  LevelFormat,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  PageOrientation
} from "docx";
import JSZip from "jszip";
import { MIME_TYPES, Reference } from "../types";
import { PageSettings } from "../components/doc/modals/PageSetupModal";
import { PAPER_SIZES } from "../components/doc/constants";
import { CommentData } from "../components/doc/CommentsSidebar";

// Importações dos novos módulos
import { processImageForDocx } from "./docx/exportImage";
import { createDocxParagraph, createDocxTable, processList, mapAlignment } from "./docx/exportNodes";

// Helper
const cmToTwips = (cm: number) => Math.round(cm * 566.929);

export const generateDocxBlob = async (
    editorJSON: any, 
    pageSettings?: PageSettings, 
    comments: CommentData[] = [], 
    references: Reference[] = [], 
    originalZip?: JSZip
): Promise<Blob> => {
  const docChildren: any[] = [];
  const content = editorJSON.content || [];

  for (const node of content) {
    try {
        if (node.type === 'paragraph' || node.type === 'heading') {
            docChildren.push(createDocxParagraph(node, comments));
        }
        else if (node.type === 'table') {
            docChildren.push(createDocxTable(node, comments));
        }
        else if (node.type === 'bulletList' || node.type === 'orderedList') {
            const listItems: Paragraph[] = [];
            processList(node, 0, node.type === 'orderedList', comments, listItems);
            docChildren.push(...listItems);
        }
        else if (node.type === 'image') {
           if (node.attrs?.src && node.attrs.src.startsWith('data:image')) {
               try {
                   const { buffer, width, height } = await processImageForDocx(
                       node.attrs.src,
                       node.attrs.crop,
                       node.attrs.width ? parseInt(node.attrs.width) : undefined,
                       node.attrs.height ? parseInt(node.attrs.height) : undefined
                   );

                   const alignment = node.attrs?.textAlign || node.attrs?.align || 'center';

                   docChildren.push(new Paragraph({
                       children: [
                           new ImageRun({
                               data: buffer,
                               transformation: {
                                   width: Math.round(width),
                                   height: Math.round(height)
                               }
                           })
                       ],
                       alignment: mapAlignment(alignment)
                   }));
               } catch (e) {
                   console.warn("Image export failed", e);
               }
           }
        }
        else if (node.type === 'blockquote') {
            const innerParagraphs = (node.content || []).map((p: any) =>
                createDocxParagraph(p, comments)
            );
            // Aplica indentação de citação em cada parágrafo interno
            innerParagraphs.forEach((para: any) => {
                if (para && para.root) {
                    para.root.indent = { left: 720, right: 720 };
                }
            });
            docChildren.push(...innerParagraphs);
        }
        else if (node.type === 'pageBreak') {
            if (docChildren.length > 0 && docChildren[docChildren.length-1] instanceof Paragraph) {
                (docChildren[docChildren.length-1] as Paragraph).addChildElement(new PageBreak());
            } else {
                docChildren.push(new Paragraph({ children: [new PageBreak()] }));
            }
        }
        // Custom Nodes Placeholder
        else if (['codeBlock', 'mathNode', 'mermaidNode', 'chart', 'qrCodeNode'].includes(node.type)) {
            
            // Tenta extrair texto do nó quando disponível
            let displayText = '';
            let warningText = '';
            
            if (node.type === 'codeBlock') {
                const codeText = node.content?.[0]?.text || '';
                const lang = node.attrs?.language || '';
                displayText = codeText;
                warningText = `[Bloco de Código${lang ? ` - ${lang}` : ''}]`;
                // Exporta o código como texto monoespaçado
                docChildren.push(new Paragraph({
                    children: [new TextRun({
                        text: codeText,
                        font: 'Courier New',
                        size: 20,
                        color: '1a1a1a'
                    })],
                    spacing: { before: 120, after: 120 }
                }));
            } else {
                // Para elementos visuais (math, mermaid, chart, qr)
                // que não têm representação textual direta
                const label = {
                    mathNode: `Fórmula: ${node.attrs?.latex || ''}`,
                    mermaidNode: 'Diagrama Mermaid',
                    chart: 'Gráfico',
                    qrCodeNode: `QR Code: ${node.attrs?.value || ''}`
                }[node.type as string] || node.type;
                
                docChildren.push(new Paragraph({
                    children: [new TextRun({
                        text: `⚠ [${label} — exportação visual não suportada]`,
                        color: 'B45309',
                        italics: true,
                        size: 18
                    })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200, after: 200 }
                }));
            }
        }
    } catch (e) {
        console.warn(`Erro exportando nó tipo ${node.type}`, e);
    }
  }

  // --- Page Config ---
  let pageProperties: any = {};
  const headers: any = {};
  const footers: any = {};

  if (pageSettings) {
      let size = PAPER_SIZES['a4'];
      if (PAPER_SIZES[pageSettings.paperSize]) {
          size = PAPER_SIZES[pageSettings.paperSize];
      }
      
      const widthTwips = cmToTwips(size.widthCm);
      const heightTwips = cmToTwips(size.heightCm);

      // Header Construction
      const headerChildren: Paragraph[] = [];
      if (pageSettings.headerText) {
          headerChildren.push(new Paragraph({
              children: [new TextRun(pageSettings.headerText)],
              alignment: AlignmentType.CENTER
          }));
      }
      if (pageSettings.pageNumber?.enabled && pageSettings.pageNumber.position === 'header') {
          const align = pageSettings.pageNumber.alignment === 'left' ? AlignmentType.LEFT :
                        pageSettings.pageNumber.alignment === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER;
          headerChildren.push(new Paragraph({
              children: [new TextRun({ children: [PageNumber.CURRENT] })],
              alignment: align,
          }));
      }
      if (headerChildren.length > 0) headers.default = new Header({ children: headerChildren });

      // Footer Construction
      const footerChildren: Paragraph[] = [];
      if (pageSettings.footerText) {
          footerChildren.push(new Paragraph({
              children: [new TextRun(pageSettings.footerText)],
              alignment: AlignmentType.CENTER
          }));
      }
      if (pageSettings.pageNumber?.enabled && pageSettings.pageNumber.position === 'footer') {
          const align = pageSettings.pageNumber.alignment === 'left' ? AlignmentType.LEFT :
                        pageSettings.pageNumber.alignment === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER;
          footerChildren.push(new Paragraph({
              children: [new TextRun({ children: [PageNumber.CURRENT] })],
              alignment: align,
          }));
      }
      if (footerChildren.length > 0) footers.default = new Footer({ children: footerChildren });

      pageProperties = {
          page: {
              size: {
                  width: widthTwips,
                  height: heightTwips,
                  orientation: pageSettings.orientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT
              },
              margin: {
                  top: cmToTwips(pageSettings.marginTop),
                  bottom: cmToTwips(pageSettings.marginBottom),
                  left: cmToTwips(pageSettings.marginLeft),
                  right: cmToTwips(pageSettings.marginRight)
              },
              pageNumbers: pageSettings.pageNumber?.startAt ? {
                  start: pageSettings.pageNumber.startAt,
                  formatType: "decimal"
              } : undefined
          }
      };
  }

  const docComments = comments.map((c, index) => ({
      id: index + 1,
      author: c.author,
      date: new Date(c.createdAt),
      children: [new Paragraph({ children: [new TextRun(c.text)] })]
  }));

  const doc = new Document({
    comments: { children: docComments },
    numbering: {
        config: [
            {
                reference: "default-bullet",
                levels: [
                    { level: 0, format: LevelFormat.BULLET, text: "\u25CF", alignment: AlignmentType.LEFT },
                    { level: 1, format: LevelFormat.BULLET, text: "\u25CB", alignment: AlignmentType.LEFT },
                    { level: 2, format: LevelFormat.BULLET, text: "\u25A0", alignment: AlignmentType.LEFT }
                ]
            },
            {
                reference: "default-ordered",
                levels: [
                    { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT },
                    { level: 1, format: LevelFormat.LOWER_LETTER, text: "%2)", alignment: AlignmentType.LEFT }
                ]
            }
        ]
    },
    styles: {
        paragraphStyles: [
            {
                id: "Normal",
                name: "Normal",
                run: { font: "Times New Roman", size: 24, color: "000000" },
                paragraph: { spacing: { line: 360 } },
            },
            {
                id: "Heading1",
                name: "Heading 1",
                run: { font: "Times New Roman", size: 32, bold: true, color: "2E74B5" },
                paragraph: { spacing: { before: 240, after: 120 } }
            },
            {
                id: "Heading2",
                name: "Heading 2",
                run: { font: "Times New Roman", size: 26, bold: true, color: "2E74B5" },
                paragraph: { spacing: { before: 240, after: 120 } }
            },
            {
                id: "Quote",
                name: "Quote",
                paragraph: { indent: { left: 720 }, spacing: { after: 200 } },
                run: { italics: true, font: "Times New Roman", size: 22 }
            }
        ]
    },
    sections: [{
      properties: pageProperties,
      headers: headers,
      footers: footers,
      children: docChildren,
    }],
  });

  const standardBlob = await Packer.toBlob(doc);

  try {
      const zip = await JSZip.loadAsync(standardBlob);
      zip.file("tiptap-state.json", JSON.stringify({ ...editorJSON, meta: { comments, references } }));
      return await zip.generateAsync({ type: "blob", mimeType: MIME_TYPES.DOCX });
  } catch (e) {
      console.warn("Falha ao injetar estado extendido no DOCX", e);
      return standardBlob;
  }
};

export const createEmptyDocxBlob = async (): Promise<Blob> => {
  const doc = new Document({
    sections: [{ properties: {}, children: [new Paragraph("")] }],
  });
  return await Packer.toBlob(doc);
};
