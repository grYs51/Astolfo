import axios from 'axios';
import { Summoner } from './types/summoners';
import { Constants, LolApi } from 'twisted';
import { env } from 'process';

const api = new LolApi({key: env.RIOT_API_KEY})

