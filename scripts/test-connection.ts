import * as bc from 'bitcraft-global';
import * as bcr from 'bitcraft-region';

function getGlobalConnection() {
  return new Promise<bc.DbConnection>((resolve, reject) => {
    bc.DbConnection.builder()
      .withUri('wss://bitcraft-early-access.spacetimedb.com')
      .withModuleName('bitcraft-live-global')
      // .withToken(process.env.SPACETIME_TOKEN)
      .onConnect((conn) => {
        console.log('Hello, Bitcraft!');
        resolve(conn);
      })
      .onConnectError((_ctx, err) => {
        console.error('Error:', err);
        reject('foo');
      })
      .onDisconnect(() => {
        console.log('Disconnected');
      })
      .build();
  });
}

function getRegionConnection(region: string) {
  return new Promise<bcr.DbConnection>((resolve, reject) => {
    bcr.DbConnection.builder()
      .withUri('wss://bitcraft-early-access.spacetimedb.com')
      .withModuleName(`bitcraft-live-${region}`)
      .withToken(process.env.SPACETIME_TOKEN)
      .onConnect((conn) => {
        console.log('Hello, Bitcraft!');
        resolve(conn);
      })
      .onConnectError((_ctx, err) => {
        reject(err);
      })
      .onDisconnect(() => {
        console.log('Disconnected');
      })
      .build();
  });
}


const conn = await getGlobalConnection();

// conn.subscriptionBuilder()
//   .onApplied((ctx) => {
//     const writer = Bun.file('claims.jsonl').writer();
//
//     for (const claim of ctx.db.claimState.iter()) {
//       writer.write(JSON.stringify(claim));
//       writer.write('\n');
//     }
//
//     writer.end()
//   })
//   .subscribe("SELECT * FROM claim_state"); 
