    exports.inject = ['slots', 'configForms', 'locale'];
    exports.apply = function apply(ctx) {
      if (typeof ctx.locale?.register === 'function') {
        if (typeof ctx.effect === 'function') {
          ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-agent-loop-guard: locale');
        } else {
          ctx.locale.register(NS, { en, zh });
        }
      }

      function registerSlotWhenReady(slotName, registerFn) {
        if (!ctx.slots) return;
        if (typeof ctx.slots.inject === 'function') {
          try {
            ctx.slots.inject(slotName, () => {
              try {
                return registerFn();
              } catch (err) {
                console.warn('[' + NS + '] Error registering slot ' + slotName + ':', err);
              }
            });
            return;
          } catch (err) {
            console.warn('[' + NS + '] Failed to inject slot ' + slotName + ':', err);
          }
        }
        if (typeof ctx.slots.register === 'function') {
          try {
            registerFn();
          } catch (err) {
            console.warn('[' + NS + '] Failed direct registration for ' + slotName + ':', err);
          }
        }
      }

      registerSlotWhenReady('plugins.row.config', () =>
        ctx.slots.register(
          {
            name: 'plugins.row.config',
            key: ROW_CONFIG_KEY,
            order: 10,
            locale: NS,
            inject: () => ({ ctx }),
          },
          (props) => React.createElement(PluginItem, { ...props, ctx: (props && props.ctx) || ctx })
        )
      );

      registerSlotWhenReady('plugins.item', () =>
        ctx.slots.register(
          {
            name: 'plugins.item',
            id: ROW_ID,
            order: 10,
            label: () => 'Agent Loop Guard',
            locale: NS,
            inject: () => ({ ctx }),
          },
          (props) => React.createElement(PluginItem, { ...props, ctx: (props && props.ctx) || ctx })
        )
      );

      registerSlotWhenReady('settings.plugin.item', () =>
        ctx.slots.register(
          {
            name: 'settings.plugin.item',
            key: NS,
            order: 95,
            locale: NS,
            inject: () => ({ ctx }),
          },
          (props) => React.createElement(PluginCard, { ...props, ctx: (props && props.ctx) || ctx })
        )
      );
    };
