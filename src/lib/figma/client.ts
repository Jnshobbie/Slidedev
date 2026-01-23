export class FigmaClient {
  constructor(private accessToken: string) {
    console.log('🔑 FigmaClient initialized');
    console.log('🔑 Token exists:', !!accessToken);
    console.log('🔑 Token length:', accessToken?.length || 0);
    console.log('🔑 Token preview:', accessToken?.substring(0, 10) + '...');
  }

  async getFile(fileKey: string) {
    console.log('📡 Calling Figma API...');
    console.log('📡 File key:', fileKey);
    console.log('📡 Token being sent:', this.accessToken.substring(0, 10) + '...');
    
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: { 
        'X-Figma-Token': this.accessToken 
      }
    });
    
    console.log('📡 Response status:', res.status);
    console.log('📡 Response headers:', Object.fromEntries(res.headers.entries()));
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Figma API error response:', errorText);
      throw new Error(`Figma API error: ${res.statusText}`);
    }
    
    return res.json();
  }

  async getFileNodes(fileKey: string, nodeIds: string[]) {
    const ids = nodeIds.join(',');
    const res = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${ids}`,
      { headers: { 'X-Figma-Token': this.accessToken } }
    );
    
    if (!res.ok) throw new Error(`Figma API error: ${res.statusText}`);
    return res.json();
  }

  async getImages(fileKey: string, nodeIds: string[], format: 'png' | 'svg' = 'png') {
    const ids = nodeIds.join(',');
    console.log('🖼️ Requesting images for nodes:', ids);
    
    const res = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${ids}&format=${format}`,
      { headers: { 'X-Figma-Token': this.accessToken } }
    );
    
    console.log('🖼️ Image export response:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Image export error:', errorText);
      throw new Error(`Figma API error: ${res.statusText}`);
    }
    
    return res.json();
  }
}