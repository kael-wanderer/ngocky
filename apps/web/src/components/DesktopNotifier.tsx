import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { isTauri } from './DesktopGate';

type FiredNotification = { key: string; title: string; subtitle?: string };

export default function DesktopNotifier() {
    const seen = useRef(new Set<string>());
    const { data } = useQuery<FiredNotification[]>({
        queryKey: ['desktop-notifications'],
        queryFn: async () => (await api.get('/notifications/recent')).data.data,
        refetchInterval: 60_000,
        enabled: isTauri,
    });

    useEffect(() => {
        if (!data?.length) return;
        (async () => {
            const { isPermissionGranted, requestPermission, sendNotification } = await import(
                '@tauri-apps/plugin-notification'
            );
            let granted = await isPermissionGranted();
            if (!granted) granted = (await requestPermission()) === 'granted';
            for (const n of data) {
                if (seen.current.has(n.key)) continue;
                seen.current.add(n.key);
                if (granted) sendNotification({ title: n.title, body: n.subtitle ?? '' });
            }
        })();
    }, [data]);

    return null;
}
