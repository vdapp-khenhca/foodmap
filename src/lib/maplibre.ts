import * as maplibregl from 'maplibre-gl';
// Bản build của Vite không tự tìm thấy file worker của MapLibre, nên chỉ rõ đường dẫn tới bản đã đóng gói.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

maplibregl.setWorkerUrl(workerUrl);

export default maplibregl;
