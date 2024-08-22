import canvas, { CanvasRenderingContext2D, loadImage } from "canvas"
import { Webhook } from 'discord-webhook-node'
import fs from "fs"
import { NextRequest, NextResponse } from "next/server"
import path from "path"

const hookURL = "https://discord.com/api/webhooks/1276194926421475388/UK4kQyLsnO56d3B8TTjIDajgFnceSlNGuQQYj4TUD_jaaBr8vA8wgAalBQskA0sgrx_P";
const hook = new Webhook(hookURL);

let previousHash = "";
export async function POST(req: NextRequest) {
  const data = await req.json();
  if (!data.minimap || data.minimap.length === 0) {
    return NextResponse.json({});
  }

  const cvs = canvas.createCanvas(400, 400);
  const ctx = cvs.getContext('2d');
  const minimap = await loadImage(path.join(process.cwd(), 'assets', 'minimap7.33.png'));
  ctx.drawImage(minimap, 0, 0);
  const minimapImg = path.join(process.cwd(), 'images', `${Math.random() * 100000000}.png`);
  const writeable = fs.createWriteStream(minimapImg, {
    flags: "w"
  })

  await drawObsAndSentries(ctx, data.minimap);
  writeable.write(cvs.toBuffer(), (err) => {
    if (err) {
      console.error('Error writing buffer:', err);
    } else {
      writeable.end();
    }
  });

  writeable.on('finish', async () => {
    console.log('sending minimap image');
    const wards = await filterObsAndSentries(data.minimap);
    fs.writeFile(obsFilePath, JSON.stringify(wards, null, 2), (err) => {
      console.error(err);
    });
    const wardsStr = wards.map((ward) => {
      return `${ward.xpos},${ward.ypos}`
    }).sort().join("|");
  
    const currentHash = wardsStr;
    console.log(`${previousHash}||${currentHash}`)
    if (previousHash !== currentHash) {
      await hook.send(`Game time: ${Math.trunc(data.map.clock_time/60)}:${(data.map.clock_time%60).toString().padStart(2, '0')}`);
      hook.sendFile(minimapImg).then(() => fs.rm(minimapImg, (err) => {}));
      previousHash = currentHash;
    }
  });
  const filePath = path.join(process.cwd(), 'public', 'data.txt');
  const obsFilePath = path.join(process.cwd(), 'public', 'obs.txt');

  fs.appendFile(filePath, JSON.stringify({ ...data.map, events: data.events }, null, 2), (err) => {
    console.error(err);
  });

  return NextResponse.json({});
}

interface MinimapVision {
  xpos: number,
  ypos: number,
  image: string,
  team: number,
  yaw: number,
  unitname: string,
  visionrange: number
}

async function filterObsAndSentries(payload: { [key: string]: MinimapVision}) {
  const results: MinimapVision[] = [];

  Object.keys(payload).forEach((k) => {
    const node = payload[k];
    if (node.unitname !== 'npc_dota_sentry_wards' && node.unitname !== 'npc_dota_observer_wards') {
      return;
    }
    results.push(node);
  })
  return results;
}

async function drawObsAndSentries(canvasContext: CanvasRenderingContext2D, payload: { [key: string]: MinimapVision}) {
  const results: MinimapVision[] = [];

  Object.keys(payload).forEach((k) => {
    const node = payload[k];
    if (node.unitname !== 'npc_dota_sentry_wards' && node.unitname !== 'npc_dota_observer_wards') {
      return;
    }

    const { x, y } = mapCoordinates(node.xpos, node.ypos);
    results.push(node);

    // Draw circles based on team
    canvasContext.beginPath();
    canvasContext.arc(x, y, node.visionrange / 100 || 5, 0, Math.PI * 2, false);  // Draw a circle with radius 10

    // Set color based on team
    if (node.team === 3) { // Dire team
      canvasContext.fillStyle = 'rgba(255, 0, 0, 0.5)';
    } else if (node.team === 2) { // Radiant team
      canvasContext.fillStyle = 'rgba(0, 255, 0, 0.5)';
    } else {
      canvasContext.fillStyle = 'gray'; // Default or unknown team
    }

    canvasContext.fill(); // Fill the circle with the chosen color
    canvasContext.closePath();
  })
}

function mapCoordinates(x: number, y: number) {
  // Define the source and destination ranges for x and y
  const sourceXMax = 10000;
  const sourceXMin = -sourceXMax;
  const sourceYMax = 9100;
  const sourceYMin = -sourceYMax;
  const destMin = 0;
  const destMax = 400;

  // Calculate the scale factors for x and y
  const scaleX = (destMax - destMin) / (sourceXMax - sourceXMin);
  const scaleY = (destMax - destMin) / (sourceYMax - sourceYMin);

  // Map the coordinates
  const mappedX = ((x - sourceXMin) * scaleX) + destMin;
  const mappedY = ((y - sourceYMin) * scaleY) + destMin;

  // Convert Cartesian coordinates to be centered
  const centerX = destMax / 2;
  const centerY = destMax / 2;

  return {
    x: centerX + mappedX - centerX,
    y: centerY - (mappedY - centerY)  // Invert y-axis if needed
  };
}