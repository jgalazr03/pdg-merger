// Web Worker for Excel compression
// This runs in a separate thread to avoid blocking the main UI

// Import ExcelJS from CDN
importScripts('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js');

class CompressionWorker {
  constructor() {
    this.isProcessing = false;
  }

  async compressExcelInWorker(data) {
    const { arrayBuffer, compressionSettings, fileId } = data;
    
    try {
      this.postProgress(fileId, 0, 'Iniciando compresión...');
      
      // Load Excel file
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      
      this.postProgress(fileId, 10, 'Archivo cargado, analizando imágenes...');
      
      // Collect all images
      const allImages = [];
      for (const worksheet of workbook.worksheets) {
        const images = worksheet.getImages();
        
        for (const image of images) {
          const imageModel = workbook.model.media.find(m => m.name === image.imageId);
          if (imageModel && imageModel.buffer) {
            const mediaIndex = workbook.model.media.findIndex(m => m.name === image.imageId);
            
            // Only process images larger than 30KB
            if (imageModel.buffer.byteLength > 30 * 1024) {
              allImages.push({
                imageModel,
                mediaIndex,
                originalSize: imageModel.buffer.byteLength
              });
            }
          }
        }
      }
      
      if (allImages.length === 0) {
        this.postProgress(fileId, 100, 'Completado - sin imágenes para comprimir');
        const buffer = await workbook.xlsx.writeBuffer();
        return { success: true, buffer, savedBytes: 0 };
      }
      
      this.postProgress(fileId, 20, `Procesando ${allImages.length} imágenes...`);
      
      const BATCH_SIZE = 5; // Smaller batches for better progress tracking
      let processedImages = 0;
      let totalSavedBytes = 0;
      
      // Process images in batches
      for (let i = 0; i < allImages.length; i += BATCH_SIZE) {
        const batch = allImages.slice(i, i + BATCH_SIZE);
        const progressPercent = 20 + Math.round((processedImages / allImages.length) * 70);
        
        this.postProgress(
          fileId, 
          progressPercent, 
          `Procesando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allImages.length / BATCH_SIZE)}...`
        );
        
        // Process batch
        for (const { imageModel, mediaIndex, originalSize } of batch) {
          try {
            // Skip very large images
            if (originalSize > 50 * 1024 * 1024) {
              console.warn(`Skipping very large image (${Math.round(originalSize / (1024 * 1024))}MB)`);
              continue;
            }
            
            const compressedBuffer = await this.compressImageInWorker(
              imageModel.buffer, 
              compressionSettings.quality, 
              compressionSettings.scale
            );
            
            // Only replace if compression provides benefit
            const compressionRatio = compressedBuffer.byteLength / originalSize;
            if (compressionRatio < 0.85) {
              workbook.model.media[mediaIndex].buffer = compressedBuffer;
              totalSavedBytes += originalSize - compressedBuffer.byteLength;
            }
          } catch (error) {
            console.warn(`Failed to compress image at index ${mediaIndex}:`, error);
          }
        }
        
        processedImages += batch.length;
        
        // Small delay to allow other operations
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      this.postProgress(fileId, 90, 'Generando archivo final...');
      
      // Save the modified workbook
      const buffer = await workbook.xlsx.writeBuffer();
      
      this.postProgress(fileId, 100, 'Compresión completada');
      
      return { 
        success: true, 
        buffer, 
        savedBytes: totalSavedBytes,
        processedImages: allImages.length 
      };
      
    } catch (error) {
      console.error('Error in worker:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
  
  async compressImageInWorker(imageBuffer, quality, scale) {
    return new Promise((resolve, reject) => {
      try {
        // Create ImageBitmap from buffer (more efficient in workers)
        const blob = new Blob([imageBuffer]);
        
        createImageBitmap(blob).then(imageBitmap => {
          // Use OffscreenCanvas for compression
          const canvas = new OffscreenCanvas(
            Math.floor(imageBitmap.width * scale),
            Math.floor(imageBitmap.height * scale)
          );
          
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
          
          canvas.convertToBlob({ 
            type: 'image/jpeg', 
            quality: quality 
          }).then(blob => {
            blob.arrayBuffer().then(arrayBuffer => {
              resolve(new Uint8Array(arrayBuffer));
            }).catch(reject);
          }).catch(reject);
          
        }).catch(reject);
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  postProgress(fileId, progress, message) {
    self.postMessage({
      type: 'progress',
      fileId,
      progress,
      message
    });
  }
}

// Worker instance
const worker = new CompressionWorker();

// Message handler
self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'compress':
      if (worker.isProcessing) {
        self.postMessage({
          type: 'error',
          error: 'Worker is already processing another file'
        });
        return;
      }
      
      worker.isProcessing = true;
      
      try {
        const result = await worker.compressExcelInWorker(data);
        self.postMessage({
          type: 'complete',
          fileId: data.fileId,
          result
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          fileId: data.fileId,
          error: error.message
        });
      } finally {
        worker.isProcessing = false;
      }
      break;
      
    default:
      self.postMessage({
        type: 'error',
        error: 'Unknown message type'
      });
  }
};
