interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface FigmaFill {
  type: string;
  color?: FigmaColor;
}

interface FigmaStyle {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  textAlignHorizontal?: string;
}

interface FigmaNode {
  type?: string;
  name?: string;
  children?: FigmaNode[];
  characters?: string;
  layoutMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  absoluteBoundingBox?: { width: number; height: number };
  fills?: FigmaFill[];
  cornerRadius?: number;
  style?: FigmaStyle;
}

interface DesignSystem {
  colors: Record<string, string>;
  typography: Record<string, unknown>;
  spacing: Record<string, string>;
}

export function generateReactComponent(node: FigmaNode, designSystem: DesignSystem): string {
  const componentName = sanitizeComponentName(node.name || 'Component');
  const jsx = nodeToJSX(node, designSystem);
  
  return `
import React from 'react';

export function ${componentName}() {
  return (
    ${jsx}
  );
}
`.trim();
}

function nodeToJSX(node: FigmaNode, designSystem: DesignSystem, depth = 0): string {
  const indent = '  '.repeat(depth);
  const styles = generateStyles(node, designSystem);
  const styleString = styles ? ` className="${styles}"` : '';
  
  if (node.type === 'TEXT') {
    const text = node.characters || '';
    return `${indent}<div${styleString}>${escapeHtml(text)}</div>`;
  }
  
  if (node.children && node.children.length > 0) {
    const tag = getHtmlTag(node);
    const childrenJSX = node.children
      .map((child: FigmaNode) => nodeToJSX(child, designSystem, depth + 1))
      .join('\n');
    
    return `${indent}<${tag}${styleString}>\n${childrenJSX}\n${indent}</${tag}>`;
  }
  
  const tag = getHtmlTag(node);
  return `${indent}<${tag}${styleString} />`;
}

function generateStyles(node: FigmaNode, designSystem: DesignSystem): string {
  const classes: string[] = [];
  
  if (node.layoutMode === 'HORIZONTAL') classes.push('flex flex-row');
  if (node.layoutMode === 'VERTICAL') classes.push('flex flex-col');
  
  if (node.primaryAxisAlignItems === 'CENTER') classes.push('justify-center');
  if (node.counterAxisAlignItems === 'CENTER') classes.push('items-center');
  
  if (node.paddingLeft) classes.push(`pl-[${node.paddingLeft}px]`);
  if (node.paddingRight) classes.push(`pr-[${node.paddingRight}px]`);
  if (node.paddingTop) classes.push(`pt-[${node.paddingTop}px]`);
  if (node.paddingBottom) classes.push(`pb-[${node.paddingBottom}px]`);
  if (node.itemSpacing) classes.push(`gap-[${node.itemSpacing}px]`);
  
  if (node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox;
    if (width) classes.push(`w-[${Math.round(width)}px]`);
    if (height) classes.push(`h-[${Math.round(height)}px]`);
  }
  
  if (node.fills && node.fills[0]?.type === 'SOLID' && node.fills[0].color) {
    const color = node.fills[0].color;
    const hex = rgbaToHex(color.r, color.g, color.b, color.a ?? 1);
    classes.push(`bg-[${hex}]`);
  }
  
  if (node.cornerRadius) {
    classes.push(`rounded-[${node.cornerRadius}px]`);
  }
  
  if (node.type === 'TEXT' && node.style) {
    if (node.style.fontSize) classes.push(`text-[${node.style.fontSize}px]`);
    if (node.style.fontWeight) classes.push(`font-[${node.style.fontWeight}]`);
    
    if (node.style.textAlignHorizontal === 'CENTER') classes.push('text-center');
    if (node.style.textAlignHorizontal === 'RIGHT') classes.push('text-right');
  }
  
  return classes.join(' ');
}

function getHtmlTag(node: FigmaNode): string {
  if (node.type === 'TEXT') return 'div';
  if (node.type === 'FRAME' || node.type === 'GROUP') return 'div';
  if (node.name?.toLowerCase().includes('button')) return 'button';
  return 'div';
}

function sanitizeComponentName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/^[0-9]/, 'Component')
    || 'FigmaComponent';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return a < 1 ? `${hex}${toHex(a)}` : hex;
}