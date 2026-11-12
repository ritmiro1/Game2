// Only imported by the explicit --smoke-test flag, with an isolated test profile.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
export async function runSmoke({ main, nativeActions, service, tabs }) {
  const checks = [];
  const renderer = await main.webContents.executeJavaScript(
    `(async()=>({title:document.title,bridge:!!window.lifeos,state:(await window.lifeos.invoke('state')).tasks.length,body:document.body.innerText.includes('LifeOS')}))()`,
  );
  assert.ok(renderer.bridge && renderer.body);
  checks.push('packaged-renderer-and-preload');
  const task = await service.invoke('save', {
    type: 'tasks',
    entity: { title: 'Windows executable persistence test' },
  });
  assert.equal(
    (await service.invoke('state')).tasks.find((t) => t.id === task.id)?.title,
    task.title,
  );
  await service.invoke('complete', { id: task.id });
  assert.equal(service.store.get('tasks', task.id).status, 'done');
  checks.push('sqlite-crud-and-task-completion');
  const fixture = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(
      '<!doctype html><html><head><title>LifeOS native fixture</title></head><body><h1>Isolated Chromium document</h1></body></html>',
    );
  });
  fixture.listen(0, '127.0.0.1');
  await once(fixture, 'listening');
  const url = `http://127.0.0.1:${fixture.address().port}/page`;
  try {
    const { id } = await nativeActions['browser:newTab']({ url, profile: 'personal' });
    const tab = tabs.get(id);
    if (tab.view.webContents.isLoading()) await once(tab.view.webContents, 'did-finish-load');
    const isolated = await tab.view.webContents.executeJavaScript(
      `({title:document.title,node:typeof require,process:typeof process,bridge:typeof window.lifeos})`,
    );
    assert.equal(isolated.title, 'LifeOS native fixture');
    assert.deepEqual(
      [isolated.node, isolated.process, isolated.bridge],
      ['undefined', 'undefined', 'undefined'],
    );
    const prefs = tab.view.webContents.getLastWebPreferences();
    assert.equal(prefs.sandbox, true);
    assert.equal(prefs.contextIsolation, true);
    assert.equal(prefs.nodeIntegration, false);
    checks.push('real-webcontentsview-load-and-privilege-isolation');
    nativeActions['browser:bounds']({
      visible: true,
      id,
      bounds: { x: 10, y: 100, width: 700, height: 400 },
    });
    assert.ok(tab.view.getVisible());
    nativeActions['browser:hide']();
    assert.equal(tab.view.getVisible(), false);
    assert.equal(nativeActions['browser:state']().activeId, null);
    nativeActions['browser:activate']({ id });
    assert.equal(tab.view.getVisible(), true);
    assert.throws(() => nativeActions['browser:newTab']({ url: 'file:///C:/Windows/win.ini' }));
    assert.throws(() => nativeActions['browser:newTab']({ url: 'javascript:alert(1)' }));
    checks.push('tab-visibility-navigation-and-dangerous-scheme-rejection');
    await tab.view.webContents.session.cookies.set({
      url,
      name: 'profile-test',
      value: 'personal',
    });
    const work = nativeActions['browser:newTab']({ url, profile: 'work' }),
      privateTab = nativeActions['browser:newTab']({ url, profile: 'private' });
    assert.equal(
      (await tabs.get(work.id).view.webContents.session.cookies.get({ url, name: 'profile-test' }))
        .length,
      0,
    );
    assert.equal(
      (
        await tabs
          .get(privateTab.id)
          .view.webContents.session.cookies.get({ url, name: 'profile-test' })
      ).length,
      0,
    );
    assert.ok(
      !(service.store.getSetting('browserTabs') || []).some((t) => t.profile === 'private'),
    );
    checks.push('separate-cookie-profiles-and-nonpersistent-private-tabs');
    for (const key of [...tabs.keys()]) nativeActions['browser:closeTab']({ id: key });
    assert.equal(nativeActions['browser:state']().tabs.length, 0);
    if (!tab.view.webContents.isDestroyed()) {
      await Promise.race([
        once(tab.view.webContents, 'destroyed'),
        new Promise((_, reject) => {
          const t = setTimeout(
            () => reject(new Error('WebContents was not destroyed after close')),
            10000,
          );
          t.unref();
        }),
      ]);
    }
    assert.ok(tab.view.webContents.isDestroyed());
    checks.push('webcontents-destruction-on-tab-close');
    assert.ok(nativeActions.displays().length > 0);
    checks.push('windows-display-enumeration-no-simulated-monitor');
    const search = await service.invoke('webSearch', { query: 'nonexistent-smoke-document' });
    assert.equal(search.results.length, 0);
    assert.equal(search.mode, 'independent');
    checks.push('own-search-empty-without-fabricated-results');
    return {
      ok: true,
      ...renderer,
      checks,
      platform: process.platform,
      node: process.versions.node,
      electron: process.versions.electron,
      at: new Date().toISOString(),
    };
  } finally {
    fixture.close();
  }
}
