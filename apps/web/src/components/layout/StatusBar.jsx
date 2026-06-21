import { useTranslation } from 'react-i18next';
import { useTabsStore } from '../../store/tabsStore.js';

export function StatusBar() {
  const { t } = useTranslation();
  const active = useTabsStore((s) => s.tabs.find((tab) => tab.id === s.activeId));
  return (
    <div className="h-6 bg-vs-status text-white flex items-center text-xs px-3 gap-4">
      <span>{t('layout.statusBar.appName')}</span>
      {active ? (
        <>
          <span className="opacity-80">{active.title}</span>
          <span className="opacity-80">
            {t('layout.statusBar.pageOf', {
              current: active.currentPage,
              total: active.pages,
            })}
          </span>
        </>
      ) : (
        <span className="opacity-80">{t('layout.statusBar.noDocOpen')}</span>
      )}
      <div className="flex-1" />
      <span className="opacity-80">{t('layout.statusBar.shortcuts')}</span>
    </div>
  );
}
