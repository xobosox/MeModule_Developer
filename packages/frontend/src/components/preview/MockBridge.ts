/**
 * Mock bridge script that simulates the ShareRing ReactNativeWebView bridge
 * inside the preview iframe.
 */
export const MOCK_BRIDGE_SCRIPT = `
(function() {
  var asyncStorage = {};

  window.ReactNativeWebView = {
    postMessage: function(raw) {
      try {
        var msg = JSON.parse(raw);
        var eventType = msg.eventType || msg.type;
        var callbackId = msg.callbackId || msg.id;
        var data = null;

        switch (eventType) {
          case 'WALLET_CURRENT_ACCOUNT':
          case 'MAIN_ACCOUNT':
            data = {
              address: 'shareledger1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu',
              pubKey: 'A1B2C3D4E5F6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
            };
            break;
          case 'WALLET_BALANCE':
            data = [{ amount: '1000000000', denom: 'nshr' }];
            break;
          case 'COMMON_APP_INFO':
            data = { language: 'en', darkMode: true, version: '1.0.0' };
            break;
          case 'COMMON_READ_ASYNC_STORAGE':
            var readKey = msg.key || msg.data?.key;
            data = asyncStorage[readKey] || null;
            break;
          case 'COMMON_WRITE_ASYNC_STORAGE':
            var writeKey = msg.key || msg.data?.key;
            var writeVal = msg.value || msg.data?.value;
            asyncStorage[writeKey] = writeVal;
            data = { success: true };
            break;
          case 'VAULT_EMAIL':
            data = 'user@example.com';
            break;
          case 'VAULT_DOCUMENTS':
            data = [
              { id: 'doc-1', type: 'passport', status: 'verified', name: 'Passport' },
              { id: 'doc-2', type: 'driver_license', status: 'pending', name: 'Driver License' }
            ];
            break;
          case 'CRYPTO_ENCRYPT':
            data = btoa(msg.data?.plainText || msg.plainText || '');
            break;
          case 'CRYPTO_DECRYPT':
            data = atob(msg.data?.cipherText || msg.cipherText || '');
            break;
          default:
            data = null;
            break;
        }

        var response = {
          callbackId: callbackId,
          eventType: eventType,
          data: data
        };

        setTimeout(function() {
          window.postMessage(JSON.stringify(response), '*');
        }, 100);
      } catch (e) {
        console.error('[MockBridge] Error handling message:', e);
      }
    }
  };
})();
`;
