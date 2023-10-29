const logs = []
const lastStatus = []
let friends;
let friendsReqs;
let enabled = DataStore.get('RN_enabled', true)

const delay = (t) => new Promise((r) => setTimeout(r, t))

export async function init(context) {
    context.socket.observe('/lol-chat/v1/friends', (data) => {
        if (!enabled) return

        console.log(data)
        if (data.eventType == 'Update') {
            //logs.push({type: 'Status Updated', id: data.data.summonerId, name: data.data.name, riotId: data.data.gameName, riotTag: data.data.gameTag, availability: data.data.availability, origin: data.data.productName, time: data.data.time})
            let statusChanged = checkStatus(data.data)
            if (!statusChanged) return console.log("Catch spam")
            Toast.success(`${data.data.name} updated your status to ${data.data.availability == 'chat' ? 'online' : data.data.availability} ${data.data.productName ? 'on '+ data.data.productName : ''}`)
        } else if (data.eventType == "Delete") {
            const id = data.uri.split('/')[4]
            const friend = friends.find((f) => f.pid === id)
            //console.log(friend)
            //logs.push({type: 'Friend Removed', id: data.data.summonerId, availability: data.data.availability, origin: data.data.productName, time: data.data.time})
            Toast.error(`Your friend ${friend.name} (${friend.gameName}#${friend.gameTag}) deleted you from the friend list`)
        } else if (data.eventType == 'Create') {
            friends.push(data.data)
            const received = friendsReqs.find((f) => f.pid === data.data.pid)
            if (received) return
            Toast.success(`${data.data.name} (${data.data.gameName}#${data.data.gameTag}) accepted your friend request`)
        }
    })
    
    context.socket.observe('/lol-chat/v1/friend-requests', (data) => {
        if (!enabled) return
        //console.log(data)
        if (data.eventType === 'Create' && data.data?.direction === 'in') {
            friendsReqs.push(data.data)
            logs.push({type: 'Friend Request Deleted', id: data.data.id, })
            Toast.success(`${data.data.name} (${data.data.gameName}#${data.data.gameTag}) sent you a friend request`)
        } else if (data.eventType === 'Delete') {
            const id = data.uri.split('/')[4]
            if (friends.find((f) => f.id == id)) return
            const summoner = friendsReqs.find((f) => f.pid === id)
            Toast.error(`${summoner.name} (${summoner.gameName}#${summoner.gameTag}) deleted the friend request`)
        }
    })
}

export async function load() {

    CommandBar.addAction({name: 'Toggle FriendsNotifier', group: "FriendsNotifier", tags: ['fn', 'toggle fn', 'fn toggle', 'toggle'], perform: () => toggle()})

    let f = await fetch('/lol-chat/v1/friends')
    friends = await f.json()
    
    while (friends.errorCode) {
        f = await fetch('/lol-chat/v1/friends')
        friends = await f.json()
        delay(500)
    }

    const fr = await fetch('/lol-chat/v1/friend-requests')
    const frs = await fr.json()
    friendsReqs = filterRequests(frs)

    //console.log(friends)
    //console.log(friendsReqs)
}

function toggle() {
    let e = DataStore.get('RN_enabled', false)
    DataStore.set('RN_enabled', !e)

    enabled = !e
    if (!e === true) Toast.success("You have succefully enabled FriendsNotifier")
    else Toast.error("You have succefully disabled FriendsNotifier") 
} 

function filterRequests(reqs) {
    //console.log(reqs)
    if (!reqs) return []
    const filtered = reqs.filter((fr) => {
        return fr.direction === 'in'
    }) 
    return filtered ? filtered : []
}

function checkStatus(data) {
    let lastS = lastStatus.find((f) => f.id == data.id)
    if (!lastS) {
        lastStatus.push(data)
        return true
    }

    if (lastS.availability != data.availability) {
        lastS.availability = data.availability
        return true
    }
}