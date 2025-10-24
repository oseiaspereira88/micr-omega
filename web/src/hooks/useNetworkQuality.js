import { useEffect, useRef, useState } from 'react';

/**
 * Hook para monitorar qualidade de rede (latência/ping)
 *
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.enabled - Se o monitoring está habilitado
 * @param {WebSocket} options.socket - WebSocket connection para medir latency
 * @param {number} options.pingInterval - Intervalo entre pings (ms)
 * @returns {Object} Métricas de rede
 */
const useNetworkQuality = ({
  enabled = true,
  socket = null,
  pingInterval = 5000,
} = {}) => {
  const [ping, setPing] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState('excellent'); // 'excellent', 'good', 'fair', 'poor'
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const pingHistory = useRef([]);
  const pingIntervalId = useRef(null);
  const pendingPings = useRef(new Map());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !socket || socket.readyState !== WebSocket.OPEN) {
      if (pingIntervalId.current) {
        clearInterval(pingIntervalId.current);
        pingIntervalId.current = null;
      }
      return;
    }

    // Função para enviar ping e medir latência
    const sendPing = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      const pingId = `ping_${Date.now()}_${Math.random()}`;
      const sendTime = performance.now();

      // Armazenar tempo de envio
      pendingPings.current.set(pingId, sendTime);

      // Enviar ping (assumindo que o servidor responde com pong)
      try {
        socket.send(JSON.stringify({
          type: 'ping',
          id: pingId,
        }));
      } catch (error) {
        console.error('[useNetworkQuality] Erro ao enviar ping:', error);
        pendingPings.current.delete(pingId);
      }

      // Timeout para limpar pings pendentes (5 segundos)
      setTimeout(() => {
        if (pendingPings.current.has(pingId)) {
          pendingPings.current.delete(pingId);
        }
      }, 5000);
    };

    // Listener para mensagens de pong
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'pong' && data.id) {
          const sendTime = pendingPings.current.get(data.id);

          if (sendTime !== undefined) {
            const receiveTime = performance.now();
            const latency = Math.round(receiveTime - sendTime);

            // Atualizar ping history
            pingHistory.current.push(latency);
            if (pingHistory.current.length > 10) {
              pingHistory.current.shift();
            }

            // Calcular ping médio
            const avgPing = Math.round(
              pingHistory.current.reduce((sum, p) => sum + p, 0) / pingHistory.current.length
            );
            setPing(avgPing);

            // Determinar qualidade da conexão
            if (avgPing < 50) {
              setConnectionQuality('excellent');
            } else if (avgPing < 100) {
              setConnectionQuality('good');
            } else if (avgPing < 200) {
              setConnectionQuality('fair');
            } else {
              setConnectionQuality('poor');
            }

            // Limpar ping pendente
            pendingPings.current.delete(data.id);
          }
        }
      } catch (error) {
        // Ignorar mensagens não-JSON ou outros erros
      }
    };

    socket.addEventListener('message', handleMessage);

    // Enviar primeiro ping imediatamente
    sendPing();

    // Configurar interval para pings periódicos
    pingIntervalId.current = setInterval(sendPing, pingInterval);

    return () => {
      socket.removeEventListener('message', handleMessage);
      if (pingIntervalId.current) {
        clearInterval(pingIntervalId.current);
        pingIntervalId.current = null;
      }
      pendingPings.current.clear();
    };
  }, [enabled, socket, pingInterval]);

  const getConnectionQualityInfo = () => {
    const qualities = {
      excellent: { label: 'Excelente', color: '#10b981', icon: '🟢' },
      good: { label: 'Bom', color: '#84cc16', icon: '🟢' },
      fair: { label: 'Aceitável', color: '#f59e0b', icon: '🟡' },
      poor: { label: 'Ruim', color: '#ef4444', icon: '🔴' },
    };

    return qualities[connectionQuality] || qualities.excellent;
  };

  return {
    ping,
    connectionQuality,
    isOnline,
    getConnectionQualityInfo,
  };
};

export default useNetworkQuality;
