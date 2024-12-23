import { voice_stats } from "@prisma/client";
import { getLonerBoard } from "./lonerLeaderboard";


const memberOne = {id:'1',user:{username:'user 1'}}
const memberTwo = {id:"2",user:{username:'user 2'}}
const memberThree = {id:"3",user:{username:'user 3'}}



describe('lonerboard',() => {
  test('full overlap', () => {
    /*
    1:  |-----------|
    2:   |-----|
    */

    const voice_stats: voice_stats[] = [
      {id:'1',guild_id:'1',member_id:'1',channel_id:'1',issued_on:new Date('2024-12-25T10:00:00'),ended_on:new Date('2024-12-25T12:00:00'),type:'1',},
      {id:'1',guild_id:'1',member_id:'2',channel_id:'1',issued_on:new Date('2024-12-25T10:30:00'),ended_on:new Date('2024-12-25T11:30:00'),type:'1',},
    ]
    const lonerboard = getLonerBoard([memberOne,memberTwo],voice_stats).toSorted((a,b)=>Number(a.id) - Number(b.id))
  
    expect(lonerboard.length).toBe(1)
    //convert hours to milliseconds
    expect(lonerboard[0].count).toBe(1 * 60 * 60 * 1000)
    expect(lonerboard[0].id).toBe('1')
  });
  test('half overlap', () => {
    /*
    1:    |-----------|
    2: |-----|
    */

    const voice_stats: voice_stats[] = [
      {id:'1',guild_id:'1',member_id:'1',channel_id:'1',issued_on:new Date('2024-12-25T09:00:00'),ended_on:new Date('2024-12-25T10:00:00'),type:'1',},
      {id:'1',guild_id:'1',member_id:'2',channel_id:'1',issued_on:new Date('2024-12-25T09:30:00'),ended_on:new Date('2024-12-25T11:00:00'),type:'1',},
    ]
    const lonerboard = getLonerBoard([memberOne,memberTwo],voice_stats).toSorted((a,b)=>Number(a.id) - Number(b.id))
  
    
    expect(lonerboard.length).toBe(2)
    //convert hours to milliseconds
    expect(lonerboard[0].count).toBe(0.5 * 60 * 60 * 1000);
    expect(lonerboard[0].id).toBe('1');
    expect(lonerboard[1].count).toBe(1 * 60 * 60 * 1000);
    expect(lonerboard[1].id).toBe('2');
  });
  test('complex overlap', () => {
    /*
    1:      |-----------|
    2:   |-----|        |------|
    3: |----|  |-----|  |----| 
    */

    const voice_stats: voice_stats[] = [
      {id:'1',guild_id:'1',member_id:'3',channel_id:'1',issued_on:new Date('2024-12-25T09:00:00'),ended_on:new Date('2024-12-25T11:00:00'),type:'1',},
      {id:'1',guild_id:'1',member_id:'2',channel_id:'1',issued_on:new Date('2024-12-25T10:00:00'),ended_on:new Date('2024-12-25T12:00:00'),type:'1',},
      {id:'1',guild_id:'1',member_id:'1',channel_id:'1',issued_on:new Date('2024-12-25T11:00:00'),ended_on:new Date('2024-12-25T16:00:00'),type:'1',},
      {id:'1',guild_id:'1',member_id:'3',channel_id:'1',issued_on:new Date('2024-12-25T12:00:00'),ended_on:new Date('2024-12-25T15:00:00'),type:'1',},
      {id:'1',guild_id:'1',member_id:'3',channel_id:'1',issued_on:new Date('2024-12-25T16:00:00'),ended_on:new Date('2024-12-25T17:00:00'),type:'1',},
      {id:'1',guild_id:'1',member_id:'2',channel_id:'1',issued_on:new Date('2024-12-25T16:00:00'),ended_on:new Date('2024-12-25T18:00:00'),type:'1',},
    ]
    const lonerboard = getLonerBoard([memberOne,memberTwo,memberThree],voice_stats).toSorted((a,b)=>Number(a.id) - Number(b.id))
    
    expect(lonerboard.length).toBe(3)
    expect(lonerboard[0].id).toBe('1');
    expect(lonerboard[0].count).toBe(1 * 60 * 60 * 1000);
    expect(lonerboard[1].id).toBe('2');
    expect(lonerboard[1].count).toBe(1 * 60 * 60 * 1000);
    expect(lonerboard[2].id).toBe('3');
    expect(lonerboard[2].count).toBe(1 * 60 * 60 * 1000);
  });
  test('no overlap', () => {
    /*
    1:      |---|
    2: |--|
    */

    const voice_stats: voice_stats[] = [
      {id:'1',guild_id:'1',member_id:'1',channel_id:'1',issued_on:new Date('2024-12-25T08:00:00'),ended_on:new Date('2024-12-25T09:00:00'),type:'1',},
      {id:'1',guild_id:'1',member_id:'2',channel_id:'1',issued_on:new Date('2024-12-25T10:00:00'),ended_on:new Date('2024-12-25T11:00:00'),type:'1',},
    ]
    const lonerboard = getLonerBoard([memberOne,memberTwo],voice_stats).toSorted((a,b)=>Number(a.id) - Number(b.id))
  
    expect(lonerboard.length).toBe(2)
    //convert hours to milliseconds
    expect(lonerboard[0].count).toBe(1 * 60 * 60 * 1000)
    expect(lonerboard[0].id).toBe('1')
    expect(lonerboard[1].count).toBe(1 * 60 * 60 * 1000)
    expect(lonerboard[1].id).toBe('2')
  });
  test('no overlap - same member', () => {
    /*
    1:   |--|  |---|
    */

    const voice_stats: voice_stats[] = [
      {id:'1',guild_id:'1',member_id:'1',channel_id:'1',issued_on:new Date('2024-12-25T08:00:00'),ended_on:new Date('2024-12-25T09:00:00'),type:'1',},
      {id:'1',guild_id:'1',member_id:'1',channel_id:'1',issued_on:new Date('2024-12-25T10:00:00'),ended_on:new Date('2024-12-25T11:00:00'),type:'1',},
    ]
    const lonerboard = getLonerBoard([memberOne,memberTwo],voice_stats).toSorted((a,b)=>Number(a.id) - Number(b.id))
  
    expect(lonerboard.length).toBe(1)
    //convert hours to milliseconds
    expect(lonerboard[0].count).toBe(2 * 60 * 60 * 1000)
    expect(lonerboard[0].id).toBe('1')
  });
})