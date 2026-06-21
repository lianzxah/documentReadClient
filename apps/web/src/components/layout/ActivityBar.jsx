import { Files, MessageSquare, Languages, Presentation, Settings, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../store/uiStore.js';
import { cn } from '../../lib/cn.js';

const ITEMS = [
  { id: 'explorer', Icon: Files, labelKey: 'layout.activityBar.documents' },
  { id: 'outline', Icon: List, labelKey: 'layout.activityBar.outline' },
  { id: 'chat', Icon: MessageSquare, labelKey: 'layout.activityBar.chat' },
  { id: 'translate', Icon: Languages, labelKey: 'layout.activityBar.translate' },
  { id: 'slidev', Icon: Presentation, labelKey: 'layout.activityBar.ppt' },
];

export function ActivityBar() {
  const { t } = useTranslation();
  const activity = useUIStore((s) => s.activity);
  const setActivity = useUIStore((s) => s.setActivity);
  const toggleSideBar = useUIStore((s) => s.toggleSideBar);
  const sideBarVisible = useUIStore((s) => s.sideBarVisible);
  const setSettingsDialogOpen = useUIStore((s) => s.setSettingsDialogOpen);

  return (
    <div className="w-12 bg-vs-activity flex flex-col items-center py-2 border-r border-vs-border">
      {ITEMS.map(({ id, Icon, labelKey }) => {
        const active = activity === id && sideBarVisible;
        return (
          <button
            key={id}
            title={t(labelKey)}
            onClick={() => {
              if (activity === id && sideBarVisible) {
                toggleSideBar();
              } else {
                setActivity(id);
                if (!sideBarVisible) toggleSideBar();
              }
            }}
            className={cn(
              'w-12 h-12 flex items-center justify-center text-vs-muted hover:text-white relative',
              active && 'text-white',
            )}
          >
            {active && (
              <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-white" />
            )}
            <Icon size={22} />
          </button>
        );
      })}
      <div className="flex-1" />
      <button
        title={t('settings.title')}
        onClick={() => setSettingsDialogOpen(true)}
        className="w-12 h-12 flex items-center justify-center text-vs-muted hover:text-white"
      >
        <Settings size={22} />
      </button>
    </div>
  );
}
