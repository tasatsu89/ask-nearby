self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch(e) {}
  const title = data.title || 'Ask Nearby'
  const options = {
    body: data.body || 'You have a new nearby update.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: data.url || '/' }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){
      if('focus' in client) {
        client.navigate(url)
        return client.focus()
      }
    }
    if(clients.openWindow) return clients.openWindow(url)
  }))
})
