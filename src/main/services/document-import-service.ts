import { dialog, type BrowserWindow } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { stripRtf } from 'rtf-to-text';
import WordExtractor from 'word-extractor';
import type { DocumentImportResult, DocumentImportTarget } from '../../shared/domain';
import { mapImportedDocument } from '../../shared/document-import';
import { ValidationError } from '../../shared/validation';
import type { ProviderService } from './provider-service';

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.json', '.csv', '.log']);
const IMAGE_MIME = new Map<string, 'image/png' | 'image/jpeg' | 'image/webp'>([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp']
]);

function decodeQuotedPrintable(value: string): string {
  const source = value.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '=' && /^[0-9A-Fa-f]{2}$/.test(source.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(source.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(source.charCodeAt(index) & 0xff);
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_match, entity: string) => {
    if (entity[0] === '#') {
      const hexadecimal = entity[1]?.toLocaleLowerCase() === 'x';
      const codePoint = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : ' ';
    }
    return named[entity.toLocaleLowerCase()] ?? ' ';
  });
}

function htmlToPlainText(html: string): string {
  return decodeHtmlEntities(html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|xml)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[\t \u3000]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function extractMhtmlText(buffer: Buffer): string {
  const source = buffer.toString('latin1');
  const htmlHeader = source.search(/Content-Type:\s*text\/html/i);
  if (htmlHeader < 0) return '';
  const bodyStartMatch = source.slice(htmlHeader).match(/\r?\n\r?\n/);
  if (!bodyStartMatch?.index) return '';
  const bodyStart = htmlHeader + bodyStartMatch.index + bodyStartMatch[0].length;
  const boundary = source.slice(bodyStart).search(/\r?\n------=_NextPart_/);
  const encodedHtml = boundary >= 0 ? source.slice(bodyStart, bodyStart + boundary) : source.slice(bodyStart);
  return htmlToPlainText(decodeQuotedPrintable(encodedHtml));
}

export async function extractLegacyWordText(buffer: Buffer): Promise<string> {
  const prefix = buffer.subarray(0, 128).toString('latin1').trimStart();
  if (prefix.startsWith('{\\rtf')) return stripRtf(buffer.toString('latin1'));
  if (/^MIME-Version:/i.test(prefix)) return extractMhtmlText(buffer);
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return (await mammoth.extractRawText({ buffer })).value;
  const extractor = new WordExtractor();
  const document = await extractor.extract(buffer);
  const body = document.getBody().trim();
  const textboxes = document.getTextboxes({ includeHeadersAndFooters: false }).trim();
  return textboxes && !body.includes(textboxes) ? `${body}\n${textboxes}`.trim() : body;
}

export class DocumentImportService {
  constructor(private readonly provider: ProviderService) {}

  async selectAndImport(parent: BrowserWindow | undefined, target: DocumentImportTarget): Promise<DocumentImportResult | null> {
    const options = {
      title: '选择需要识别的图片或文件',
      properties: ['openFile'] as Array<'openFile'>,
      filters: [
        { name: '支持的文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'doc', 'docx', 'txt', 'md', 'markdown', 'json', 'csv', 'log'] },
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
        { name: '文档', extensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'markdown', 'json', 'csv', 'log'] }
      ]
    };
    const selection = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (selection.canceled || !selection.filePaths[0]) return null;
    return this.importFile(selection.filePaths[0], target);
  }

  async importFile(filePath: string, target: DocumentImportTarget): Promise<DocumentImportResult> {
    if (!['job', 'profile', 'knowledge'].includes(target)) throw new ValidationError('导入目标无效');
    const info = await stat(filePath);
    if (!info.isFile()) throw new ValidationError('请选择一个有效文件');
    if (info.size <= 0) throw new ValidationError('文件内容为空');
    if (info.size > MAX_FILE_BYTES) throw new ValidationError('文件不能超过 12 MB');

    const extension = path.extname(filePath).toLocaleLowerCase();
    const fileName = path.basename(filePath);
    const buffer = await readFile(filePath);
    let text = '';
    let mode: 'local' | 'ai-vision' = 'local';
    const warnings: string[] = [];

    if (TEXT_EXTENSIONS.has(extension)) {
      text = buffer.toString('utf8');
    } else if (extension === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      if (result.messages.length) warnings.push('Word 中的复杂排版或图片可能未完整导入。');
    } else if (extension === '.doc') {
      text = await extractLegacyWordText(buffer);
      warnings.push('已在本机读取旧版 Word 或 Word 网页文档；复杂文本框、艺术字仍需人工核对。');
    } else if (extension === '.pdf') {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        text = result.text;
        if (text.replace(/\s/g, '').length < 80) {
          const screenshots = await parser.getScreenshot({ desiredWidth: 1600, first: 5, imageDataUrl: false });
          const pages: string[] = [];
          for (const page of screenshots.pages) {
            pages.push(await this.provider.recognizeImage(Buffer.from(page.data), 'image/png', target));
          }
          text = pages.join('\n\n');
          mode = 'ai-vision';
          warnings.push(`PDF 没有足够的可提取文字，已将前 ${screenshots.pages.length} 页发送到当前 AI Provider 识别。`);
        }
      } finally {
        await parser.destroy();
      }
      if (!text.trim()) throw new ValidationError('没有从 PDF 中识别出有效文字');
    } else {
      const mimeType = IMAGE_MIME.get(extension);
      if (!mimeType) throw new ValidationError('仅支持 PNG、JPG、WEBP、PDF、DOC、DOCX、TXT、Markdown、JSON、CSV 和 LOG');
      text = await this.provider.recognizeImage(buffer, mimeType, target);
      mode = 'ai-vision';
      warnings.push('图片内容已发送到当前启用的 AI Provider 进行识别。');
    }

    if (!text.trim()) throw new ValidationError('没有从文件中识别出有效文字');
    return mapImportedDocument(target, fileName, text, mode, warnings);
  }
}
