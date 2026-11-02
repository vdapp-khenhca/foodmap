// Service worker tối giản: giúp trình duyệt cho phép "Thêm vào màn hình chính".
// Không cache nội dung để tránh hiển thị phiên bản cũ khi đang thử nghiệm.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
