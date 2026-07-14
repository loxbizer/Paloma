// Shims minimaux pour faire tourner GLTFExporter (three.js) sous Node.
// Aucune texture n'est utilisée (vertex colors uniquement), donc pas besoin de canvas.

export function installShims() {
  if (typeof globalThis.FileReader === 'undefined') {
    globalThis.FileReader = class FileReader {
      constructor() {
        this.onloadend = null;
        this.onload = null;
        this.onerror = null;
        this.result = null;
      }
      readAsArrayBuffer(blob) {
        blob.arrayBuffer().then((buf) => {
          this.result = buf;
          if (this.onload) this.onload({ target: this });
          if (this.onloadend) this.onloadend({ target: this });
        }).catch((err) => {
          if (this.onerror) this.onerror(err);
        });
      }
      readAsDataURL(blob) {
        blob.arrayBuffer().then((buf) => {
          const b64 = Buffer.from(buf).toString('base64');
          this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
          if (this.onload) this.onload({ target: this });
          if (this.onloadend) this.onloadend({ target: this });
        }).catch((err) => {
          if (this.onerror) this.onerror(err);
        });
      }
    };
  }
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
  }
}
