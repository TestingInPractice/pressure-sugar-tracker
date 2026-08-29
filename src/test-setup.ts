import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom не реализует Blob.prototype.text() (jsdom#2555) — полифилл для тестов
if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function (this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
