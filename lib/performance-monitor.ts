export interface PerformanceMetrics {
  fileSize: number;
  fileName: string;
  compressionMethod: 'worker' | 'api' | 'main-thread';
  startTime: number;
  endTime?: number;
  duration?: number;
  originalSize: number;
  compressedSize?: number;
  compressionRatio?: number;
  memoryUsage?: {
    initial: number;
    peak: number;
    final: number;
  };
  imageStats?: {
    total: number;
    processed: number;
    skipped: number;
    avgCompressionRatio: number;
  };
  errors?: string[];
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  
  startMonitoring(fileId: string, fileName: string, fileSize: number, method: PerformanceMetrics['compressionMethod']): void {
    const startTime = performance.now();
    const initialMemory = this.getMemoryUsage();
    
    this.metrics.set(fileId, {
      fileSize,
      fileName,
      compressionMethod: method,
      startTime,
      originalSize: fileSize,
      memoryUsage: {
        initial: initialMemory,
        peak: initialMemory,
        final: initialMemory
      },
      errors: []
    });
    
    console.log(`📊 Started monitoring compression for ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)}MB) using ${method}`);
  }
  
  updateProgress(fileId: string, progress: number, imageStats?: Partial<PerformanceMetrics['imageStats']>): void {
    const metric = this.metrics.get(fileId);
    if (!metric) return;
    
    const currentMemory = this.getMemoryUsage();
    if (metric.memoryUsage && currentMemory > metric.memoryUsage.peak) {
      metric.memoryUsage.peak = currentMemory;
    }
    
    if (imageStats) {
      metric.imageStats = { 
        total: imageStats.total ?? metric.imageStats?.total ?? 0,
        processed: imageStats.processed ?? metric.imageStats?.processed ?? 0,
        skipped: imageStats.skipped ?? metric.imageStats?.skipped ?? 0,
        avgCompressionRatio: imageStats.avgCompressionRatio ?? metric.imageStats?.avgCompressionRatio ?? 0
      };
    }
    
    // Log memory warnings for large files
    if (metric.fileSize > 100 * 1024 * 1024 && currentMemory > 500 * 1024 * 1024) {
      console.warn(`⚠️ High memory usage detected: ${(currentMemory / 1024 / 1024).toFixed(1)}MB`);
    }
  }
  
  recordError(fileId: string, error: string): void {
    const metric = this.metrics.get(fileId);
    if (!metric) return;
    
    metric.errors = metric.errors || [];
    metric.errors.push(error);
    console.error(`❌ Error in compression for ${metric.fileName}:`, error);
  }
  
  finishMonitoring(fileId: string, compressedSize?: number): PerformanceMetrics | null {
    const metric = this.metrics.get(fileId);
    if (!metric) return null;
    
    const endTime = performance.now();
    const finalMemory = this.getMemoryUsage();
    
    metric.endTime = endTime;
    metric.duration = endTime - metric.startTime;
    metric.compressedSize = compressedSize;
    metric.compressionRatio = compressedSize ? compressedSize / metric.originalSize : undefined;
    
    if (metric.memoryUsage) {
      metric.memoryUsage.final = finalMemory;
    }
    
    this.logSummary(metric);
    
    // Clean up old metrics (keep only last 10)
    if (this.metrics.size > 10) {
      const firstKey = this.metrics.keys().next().value;
      if (firstKey) {
        this.metrics.delete(firstKey);
      }
    }
    
    return metric;
  }
  
  private getMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize || 0;
    }
    return 0;
  }
  
  private logSummary(metric: PerformanceMetrics): void {
    const duration = metric.duration ? (metric.duration / 1000).toFixed(1) : 'N/A';
    const compressionRatio = metric.compressionRatio ? (metric.compressionRatio * 100).toFixed(1) : 'N/A';
    const memoryPeak = metric.memoryUsage?.peak ? (metric.memoryUsage.peak / 1024 / 1024).toFixed(1) : 'N/A';
    
    console.log(`
📈 Compression Summary for ${metric.fileName}:
┌─────────────────────────────────────────────────────────┐
│ Method: ${metric.compressionMethod.padEnd(20)} │
│ Duration: ${duration}s${' '.repeat(15 - duration.length)} │
│ Original: ${(metric.originalSize / 1024 / 1024).toFixed(1)}MB${' '.repeat(15 - (metric.originalSize / 1024 / 1024).toFixed(1).length)} │
│ Compressed: ${metric.compressedSize ? (metric.compressedSize / 1024 / 1024).toFixed(1) + 'MB' : 'N/A'}${' '.repeat(15 - (metric.compressedSize ? (metric.compressedSize / 1024 / 1024).toFixed(1) + 'MB' : 'N/A').length)} │
│ Ratio: ${compressionRatio}%${' '.repeat(20 - compressionRatio.length)} │
│ Peak Memory: ${memoryPeak}MB${' '.repeat(15 - memoryPeak.length)} │
│ Images: ${metric.imageStats?.processed || 0}/${metric.imageStats?.total || 0}${' '.repeat(15 - (metric.imageStats?.processed || 0).toString().length - (metric.imageStats?.total || 0).toString().length - 1)} │
│ Errors: ${metric.errors?.length || 0}${' '.repeat(20 - (metric.errors?.length || 0).toString().length)} │
└─────────────────────────────────────────────────────────┘
    `);
    
    if (metric.errors && metric.errors.length > 0) {
      console.warn(`⚠️ Errors encountered:`, metric.errors);
    }
    
    // Performance recommendations
    if (metric.duration && metric.duration > 300000) { // 5 minutes
      console.warn(`⏱️ Long compression time detected. Consider using server-side compression for files > 100MB`);
    }
    
    if (metric.memoryUsage?.peak && metric.memoryUsage.peak > 1024 * 1024 * 1024) { // 1GB
      console.warn(`🧠 High memory usage detected. Consider reducing batch size or using API compression`);
    }
  }
  
  getMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }
  
  clearMetrics(): void {
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();
