'use strict';

var path = require('path');
var _ = require('lodash');
var mongoose = require('mongoose');
var playerService = require('../services/player.server.service.js');
var util = require('../../AI/util');
var qs = require('querystring');
var config = require('../../../config/config'),
    BASE64 = require('../../AI/base64'),
    constant = require('../../constant/constant'),
    playerLink = require('../../AI/playerLink'),
    seatInfoService = require('../../seatinfo/services/seatInfo.service'),
    playerStatisticService = require('../../AI/playerStatistic');

exports.connect = connect;
exports.requstUserInfo = requstUserInfo;
exports.doAction = doAction;
exports.requstMessage = requstMessage;
exports.showdown = showdown; //摊牌

var player = function() {
    this.user = config.player.user, this.msg_id = 1, this.playNum = 0,//游戏局数
        this.seatinfos = [],
        this.holdCards = [], this.commonCards = [], this.currentTotalCardCount = 0,
        this.blind = 0,
        this.allUserInfor = [],//记录所有玩家信息
        this.newMoney = 100000,
        this.totalUser = 0,
        this.gameStatus = 0,
        this.statusFlag = 1,
        this.imSmallBlind = false, this.imBigBlind = false, this.checkInFlop = false, this.checkInTurn = false,
        this.checkInRiver = false, this.checkPreFlop = false, this.cardType=null, this.listenOuts=null, this.oneHasAllIn = false,
        this.listenType=null, this.iamListeningCard = false, this.winrate = 0, this.wager = 0, this.myMoney = 0, this.allUserSeatInfo = [],
        this.me = {}, this.bigBlindBet = 200, this.preflopThreshold = {}, this.avtivePlayers = 0, this.myListenWinProba = 0,
        this.smallBlindSeat = {}, this.bigBlindSeat = {}, this.otherSeats = {},
        this.jetton = 0,//现有的筹码
        this.money= 0, //现有的金币
        this.totalPot = 0, //奖池所有筹码
        this.currentNutHand = constant.holdCard.HIGH_CARD, //当前最大手牌
        this.link = new playerLink(),
        this.playerStatisticTable = new Map(), //历史表
        this.inquires = [], //每一阶段用户信息的询问数据
        this.money_1st=0,
        this.money_2nd=0,
        this.money_3rd=0,
            this.state = constant.state.PreFlop,
            this.state_ff1 = constant.state.PreFlop,
    this.leastRaiseBet=200, this.opponentGoodHandsNum=0, this.opponentGoodFlopLvl1Num=0, this.opponentGoodFlopLvl2Num=0, this.opponentGoodTurnLvl1Num=0, this.opponentGoodTurnLvl2Num=0, this.opponentGoodRiverLvl1Num=0, this.opponentGoodRiverLvl2Num=0,
            this.flopInqNum=0, this.curCallBet=100, this.lastCallBet=0, this.detaCallBet=100,
            this.preflopRaiseCnt=0, this.maxRaiseNum = 1, this.flopRaiseCnt=0, this.turnRaiseCnt=0, this.riverRaiseCnt=0, this.totalPot=0, this.playerMinJetton=32000, this.playerMaxJetton=0, this.totalMoney=100000, this.totalMoneyPerPlayer=100000, this.initJetton=2000, this.smallBlindBet=100, this.bigBlindBet=200,
            this.money_1st=0, this.money_2nd=0, this.money_3rd=0, this.preflopLoseProba=0, this.flopLoseProba=0, this.turnLoseProba=0, this.riverLoseProba=0;
}
var myself = new player();

let precision=0.01, handLvl, handLvlThreshold=4, frontNum=0, backNum=0, preflopFrontNum=0,
    preflopBackNum=0, backCrazyOpponentNum=0, crazyOpponentNum=0, backGoodHandsNum=0, opponentGoodHandsNum=0,
    opponentGoodFlopLvl1Num=0, opponentGoodTurnLvl1Num=0, opponentGoodRiverLvl1Num=0, oppoPreflopBet=0, flopInqNum = 0,
    maxOppoPreflopBet=0, minOppoPreflopBet=1000, maxPreflopLvl1Threshold=0,
    minPreflopLvl1Threshold=1000, maxPreflopRaiseLvl1Threshold=0, minPreflopRaiseLvl1Threshold=1000, oppoFlopBet=0,
    maxOppoFlopBet=0, minOppoFlopBet=1000, maxFlopLvl1Threshold=0, minFlopLvl1Threshold=1000, maxFlopLvl2Threshold=0, minFlopLvl2Threshold=2000,
    maxFlopRaiseLvl1Threshold=0, minFlopRaiseLvl1Threshold=1000, maxFlopRaiseLvl2Threshold=0, minFlopRaiseLvl2Threshold=2000, oppoTurnBet=0, maxOppoTurnBet=0, minOppoTurnBet=1000, maxTurnLvl1Threshold=0, minTurnLvl1Threshold=1000, maxTurnLvl2Threshold=0, minTurnLvl2Threshold=2000, maxTurnRaiseLvl1Threshold=0, minTurnRaiseLvl1Threshold=1000, maxTurnRaiseLvl2Threshold=0, minTurnRaiseLvl2Threshold=2000, oppoRiverBet=0, maxOppoRiverBet=0, minOppoRiverBet=1000, maxRiverLvl1Threshold=0, minRiverLvl1Threshold=1000, maxRiverRaiseLvl1Threshold=0, minRiverRaiseLvl1Threshold=1000,bigBlindBet = 200;

function connect() {
    let criteria = {
        deskid: config.player.deskid,
        user: config.player.user,
        pass: config.player.pass,
    }
    playerService.connect(criteria, function(err, result){
        if(err) return {};
        else{
            if(result){
                requstUserInfo(2)
                myself.msg_id = result.msg_id
                setInterval(function(){
                    // requstUserInfo(2);
                    requstMessage(result.token, myself.msg_id)
                }, 200)
            }
        }
    })
};

///获取用户信息
function requstUserInfo(type) {
    let criteria = {
        deskid: config.player.deskid,
        type: type,
    }
    playerService.requstUserInfo(criteria, function(err, result){
        if(err) return {};
        else{
            if(!_.isEmpty(result.users_info)){
                myself.msg_id = result.msgid;
                myself.msg_id++;
                myself.allUserInfor = result.users_info;
                myself.totalUser = myself.allUserInfor.length;
                myself.avtivePlayers = myself.totalUser;
                // if(!_.isEmpty(allUserInfor)){
                //     allUserInfor.forEach(function(user){
                //         var seat = new seatInfo();
                //         seat.user = user.user;
                //         seat.position = user.position;
                //         seat.user_status = user.user_status;
                //         seat.money = user.money; // 用户当前牌局开局时剩余筹码
                //         seat.wager = user.wager; // 用户当前牌局已经投入的筹码
                //         allUserSeatInfo.push(seat);
                //     })
                // }
            }
        }
    })
};

function doAction(token, type, money) {
    let criteria = {
        deskid: config.player.deskid,
        token: token,
        type: type,
        money: money,
    }
    playerService.doAction(criteria, function(err, result){
        if(err) return {};
        else{
            console.log('in doAction', result)
            return result
        }
    })
};

function requstMessage(token, msgid) {
    let criteria = {
        deskid: config.player.deskid,
        token: token,
        msgid: msgid,//请求的时候的就的消息ID
        count: 1,
    }
    // criteria.msgid =
    playerService.requstMessage(criteria, function(err, result){
        if(err) return {};
        else{
            if(result.ret === 0){
                if(!_.isEmpty(result.msgs)){
                    myself.msg_id = result.msgs[0].msg_id + 1;
                    console.log('msg_id',myself.msg_id)
                    var msg = JSON.parse(BASE64.decode(result.msgs[0].msg));
                    switch (result.msgs[0].msg_type){
                        case 1:
                            console.log('用户状态', msg)
                            if(msg.users_info[0].user_status===5) myself.oneHasAllIn = true;
                            if(msg.users_info[0].user_status===4) myself.avtivePlayers -= 1;
                            myself.imSmallBlind = _.filter(myself.seatinfos, {'isSmallBlind':true}).user === msg.users_info[0].user;
                            myself.imBigBlind = _.filter(myself.seatinfos, {'isBigBlind':true}).user === msg.users_info[0].user;
                            if(msg.users_info[0].user === config.player.user){
                                myself.wager = msg.users_info[0].wager;
                                myself.myMoney = msg.users_info[0].money;
                                myself.me = msg.users_info[0];
                            }

                            //下注前更新链表信息
                            let curSeat = myself.link.GetPlayerByUser(msg.users_info[0].user)
                            console.log('-------updatePlayerStatisticTable curSeat----------', curSeat)
                            if(curSeat){
                                curSeat.money = msg.users_info[0].money;
                                curSeat.isFold = msg.users_info[0].user_status == 4?true:false;
                                curSeat.isAllin = msg.users_info[0].user_status == 5?true:false;
                                curSeat.bet = msg.users_info[0].wager;
                                curSeat.jetton = msg.users_info[0].money;
                                console.log('before updatePlayerStatisticTable curSeat', curSeat)
                                updatePlayerStatisticTable(curSeat, myself.gameStatus);
                                console.log('after updatePlayerStatisticTable curSeat', curSeat)
                            }

                            if(msg.users_info[0].user === config.player.user && msg.users_info[0].user_status === 2){ //告诉自己要下注
                                console.log('--------------自己要下注----------------')
                                var newMsgid = result.last_msg_id,
                                    type = 7, money = 0;
                                if(myself.oneHasAllIn) {
                                    type = 8;
                                    money = 0;
                                    myself.oneHasAllIn = false;
                                }else{
                                    var len = myself.allUserInfor.length,
                                        ownPosion = 1,//自己的位置
                                        ownWager = 0,//自己的当局筹码
                                        maxWager = 0;//最大的筹码
                                    //计算出本次行动要跟进的话至少要跟注的数额
                                    myself.link.seek(myself.link.Me());	//定位到自己的位置
                                    myself.lastCallBet = myself.link.MySeat().bet;	//获取自己上次的投注额
                                    while(myself.link.curNextSeat().user !== myself.link.MySeat().user){
                                        if(myself.link.CurrentSeat().bet - myself.lastCallBet > myself.detaCallBet){
                                            myself.detaCallBet = myself.link.CurrentSeat().bet - myself.lastCallBet;
                                        }
                                    }
                                    console.log('计算出本次行动要跟进的话至少要跟注的数额', myself.detaCallBet)
                                    console.log('myself.gameStatus', myself.gameStatus)

                                    //本次动作如果跟进至少要达到curCallBet的投注额
                                    myself.curCallBet = myself.lastCallBet + myself.detaCallBet;
                                    //如果所有对手都已经弃牌了，
                                    if(myself.link.GetActivePlayerNum() < 2){
                                        type = 4;
                                    }
                                    //如果自己的筹码远远超出对手，则进入弃牌模式
                                    else if(isJettonDominated(myself.link.MySeat().bet+myself.link.MySeat().jetton+myself.link.MySeat().money,myself.totalMoney,myself.link.GetPlayerNum(),myself.smallBlindBet,myself.bigBlindBet,myself.playNum,constant.MAX_PLAYNUM)){
                                        console.log('如果自己的筹码远远超出对手，则进入弃牌模式')
                                        //能让则让
                                        if(myself.detaCallBet == 0){
                                            type = 7;
                                        }
                                        //否则，弃牌
                                        else{
                                            type = 8;
                                        }
                                    }
                                    //如果还有没弃牌的对手，则做决策
                                    else if(myself.gameStatus == 2 && myself.link.MySeat().isFold==false && myself.link.MySeat().isAllin==false){ //牌局状态 发底牌，如果不是大小盲注，就执行该下注
                                        console.log('牌局状态 本人下注-------------------')
                                        //根据自己手牌估算输掉的概率
                                        let preflopThreshold;
                                        if(myself.link.GetPlayerNum()>=8 || isJettonEnough(myself.link.MySeat().bet+myself.link.MySeat().jetton+myself.link.MySeat().money,myself.money_2nd,myself.money_3rd,myself.link.GetPlayerNum(),myself.smallBlindBet,myself.bigBlindBet,myself.playNum,constant.MAX_PLAYNUM)){
                                            console.log('根据自己手牌估算输掉的概率1')
                                            preflopThreshold = GetPreFlopThreshold_loose();
                                        }
                                        else{
                                            console.log('根据自己手牌估算输掉的概率2')
                                            preflopThreshold = GetPreFlopThreshold_loose();
                                        }
                                        console.log('---------preflopThreshold-------------', preflopThreshold)
                                        //如果阈值允许，则加注相应的数量
                                        if(preflopThreshold.raiseThreshold>2*myself.detaCallBet-precision && preflopThreshold.raiseThreshold-myself.detaCallBet>myself.leastRaiseBet && myself.preflopRaiseCnt<myself.maxRaiseNum){
                                            myself.preflopRaiseCnt++;
                                            type = 5;
                                            money = Math.floor((preflopThreshold.raiseThreshold-myself.detaCallBet)/myself.leastRaiseBet)*myself.leastRaiseBet
                                        }
                                        //否则，能让则让
                                        else if(myself.detaCallBet==0){
                                            type = 7;
                                        }
                                        //否则，如果阈值允许，则跟
                                        else if(preflopThreshold.followThreshold>myself.detaCallBet || preflopThreshold.followThreshold>=myself.link.MySeat().jetton){
                                            type = 4;
                                        }
                                        //否则，弃牌
                                        else{
                                            type = 8;
                                        }
                                    }else if(myself.gameStatus==4){ //牌局状态 翻牌
                                        console.log('牌局状态 翻牌-----------------------')
                                        let isSuite = 0; let myHandWinProba; let raiseThreshold; let followThreshold;
                                        if(myself.iamListeningCard){
                                            raiseThreshold = Math.max(0.2 * totalPot, 100);
                                            followThreshold=Math.max(myListenWinProba/(1-myListenWinProba)* totalPot, 0.5* totalPot);
                                        } else{
                                            raiseThreshold=0;
                                            followThreshold=Math.max(myListenWinProba/(1-myListenWinProba)*totalPot, 0.4 *totalPot);
                                        }
                                        if(maxWager > ownWager && raiseThreshold > 2* 100 && raiseThreshold-100 > 100){//可选项：跟注 --- 加注 ---allin --- 弃牌
                                            var flowMoney = maxWager - ownWager;//如果要跟注的金额
                                            type = 5;
                                            money = Math.floor(((raiseThreshold-100)/100)*100)
                                        }else if(maxWager == ownWager){//1：全部是0 可选项：看牌--下注 ---allin --弃牌
                                            type = 7;
                                            money = 0;
                                        }else if(followThreshold > 100 || followThreshold >= myMoney){
                                            type = 4;
                                            money = 0;
                                        }else{
                                            type = 8;
                                        }
                                    }else if(myself.gameStatus==5){//牌局状态 转牌（发第四张公共牌）
                                        console.log('牌局状态 转牌---------------------------')
                                        let isSuite = 0; let myHandWinProba; let raiseThreshold; let followThreshold;
                                        if(myself.iamListeningCard){
                                            raiseThreshold = 0.25*totalPot;
                                            followThreshold=Math.max(myself.myListenWinProba/(1-myself.myListenWinProba)* totalPot, 0.5* totalPot);
                                        } else{
                                            raiseThreshold=0;
                                            followThreshold=Math.max(myself.myListenWinProba/(1-myself.myListenWinProba)*totalPot, 0.4 *totalPot);
                                        }
                                        if(maxWager > ownWager && raiseThreshold > 2* 100 && raiseThreshold-100 > 100){//可选项：跟注 --- 加注 ---allin --- 弃牌
                                            var flowMoney = maxWager - ownWager;//如果要跟注的金额
                                            type = 5;
                                            money = Math.floor(((raiseThreshold-100)/100)*100)
                                        }else if(maxWager == ownWager){//1：全部是0 可选项：看牌--下注 ---allin --弃牌
                                            type = 7;
                                            money = 0;
                                        }else if(followThreshold > 100 || followThreshold >= myMoney){
                                            type = 4;
                                            money = 0;
                                        }else{
                                            type = 8;
                                        }
                                    }else if(myself.gameStatus==6){//牌局状态 河牌（发第五张公共牌）
                                        console.log('牌局状态 河牌---------------------------------')
                                        let isSuite = 0; let myHandWinProba; let raiseThreshold; let followThreshold;
                                        if(myself.iamListeningCard){
                                            raiseThreshold =0;
                                            followThreshold=0.5* totalPot;
                                        } else{
                                            raiseThreshold=0;
                                            followThreshold=0.4 *totalPot;
                                        }
                                        if(maxWager > ownWager && raiseThreshold > 2* 100 && raiseThreshold-100 > 100){//可选项：跟注 --- 加注 ---allin --- 弃牌
                                            var flowMoney = maxWager - ownWager;//如果要跟注的金额
                                            type = 5;
                                            money = Math.floor(((raiseThreshold-100)/100)*100)
                                        }else if(maxWager == ownWager){//1：全部是0 可选项：看牌--下注 ---allin --弃牌
                                            type = 7;
                                            money = 0;
                                        }else if(followThreshold > 100 || followThreshold >= myMoney){
                                            type = 4;
                                            money = 0;
                                        }else{
                                            type = 8;
                                        }
                                    }else if(myself.gameStatus==7){//牌局状态 摊牌

                                    }
                                }
                                console.log('type', type) ; console.log('money', money)
                                doAction(token, type, money)

                                //下注后更新链表信息
                                let curSeat = myself.link.GetPlayerByUser(msg.users_info[0].user)
                                console.log('-------updatePlayerStatisticTable curSeat----------', curSeat)
                                if(curSeat){
                                    curSeat.money = msg.users_info[0].money;
                                    curSeat.isFold = msg.users_info[0].user_status == 4?true:false;
                                    curSeat.isAllin = msg.users_info[0].user_status == 5?true:false;
                                    curSeat.bet = msg.users_info[0].wager;
                                    curSeat.jetton = msg.users_info[0].money;
                                    console.log('before updatePlayerStatisticTable curSeat', curSeat)
                                    updatePlayerStatisticTable(curSeat, myself.gameStatus);
                                    console.log('after updatePlayerStatisticTable curSeat', curSeat)
                                }

                            }else if(msg.users_info[0].user !== config.player.user){
                                if(msg.users_info[0].user_status == 6){//已经出局就T出allUserInfor所有的玩家数组中
                                    for(var i=0;i<myself.allUserInfor.length;i++){
                                        if(myself.allUserInfor[i].user == msg.users_info[0].user){
                                            myself.allUserInfor.splice(i,1);
                                        }
                                    }
                                }else{//除了出局的其他状态都更新用户的前牌局已经投入的筹码
                                    for(var i=0;i<myself.allUserInfor.length;i++){
                                        if(myself.allUserInfor[i].user == msg.users_info[0].user){
                                            myself.allUserInfor[i].wager == msg.users_info[0].wager
                                        }
                                    }
                                }
                            }
                            break;
                        case 2:
                            console.log('牌局状态', msg)
                            myself.gameStatus = msg.game_status;
                            if(msg.game_status == 1){   //牌局开始的时候应该更新所有用户信息
                                console.log('-----------牌局开始了-------------')
                                myself.playNum += 1;
                                requstUserInfo(1);//更新到最新的用户信息

                            }else if(msg.game_status == 4 || msg.game_status == 5 || msg.game_status == 6 ){
                                for(var i=0;i<myself.allUserInfor.length;i++){//当翻、转、河牌时，就把所有玩家的当轮已经投入的筹码清零
                                    myself.allUserInfor[i].wager = 0;
                                }
                            }else if(msg.game_status == 7){//执行摊牌操作
                                console.log('执行摊牌操作 listenCard commonCards', myself.commonCards)
                                let cc = []
                                myself.commonCards.forEach(function(card){
                                    let c = {};
                                    c.type = parseInt((card - 1)/13) + 1 ;
                                    c.point = parseInt(card %13) == 0 ? 13 : parseInt(card %13);
                                    c.point = c.point===1? 14: c.point;
                                    cc.push(c)
                                });
                                console.log('执行摊牌操作 holdCards', myself.holdCards)
                                console.log('执行摊牌操作 getBiggest', cc)
                                let ret = util.getBiggest(myself.holdCards.concat(cc))
                                console.log('执行摊牌操作 ret', ret)

                                if(!_.isEmpty(ret)){
                                    let out = []
                                    out = _.difference(changeCards(ret.get('maxCardList')), changeCards(myself.holdCards))
                                    console.log('执行摊牌操作 out', out)
                                    showdown(token, out)
                                }
                                else
                                    showdown(token, [])
                            }else if(msg.game_status == 8){
                                myself.allUserInfor.length = 0;//清空之前的对于玩家的记录
                            }
                            break;
                        case 3:
                            console.log('发底牌-----------------', msg)
                            if(msg.user == config.player.user && !myself.checkPreFlop){ //发底牌
                                let cards = msg.cards;
                                cards.forEach(function(card){
                                    let c = {};
                                    c.type = parseInt((card - 1)/13) + 1 ;
                                    c.point = parseInt(card %13) == 0 ? 13 : parseInt(card %13);
                                    c.point = c.point===1? 14: c.point;
                                    myself.holdCards.push(c)
                                });
                                console.log('holdCards', myself.holdCards)
                                myself.checkPreFlop = true;
                                myself.currentTotalCardCount = 2;
                            }
                            // preflopThreshold = GetPreFlopThreshold_loose();
                            // console.log('GetPreFlopThreshold_loose' ,preflopThreshold)
                            break;
                        case 4:
                            console.log('下注中-----------------', msg)
                            myself.totalPot += msg.money;
                            console.log('totalPot', myself.totalPot)
                            // let player = _.filter(myself.allUserInfor, {'user': msg.user})
                            myself.allUserInfor.forEach(function(user){
                                if(myself.blind === 0 && user.user === msg.user && msg.money === 100){
                                    let seatInfo = new seatInfoService()
                                    seatInfo.user = user.user;
                                    seatInfo.jetton = user.money - msg.money;
                                    seatInfo.money = user.money - msg.money;
                                    seatInfo.isSmallBlind = true;
                                    user.isSmallBlind = true;
                                    myself.allUserSeatInfo.push(seatInfo)
                                    if(msg.user === config.player.user) {
                                        myself.me.isSmallBlind = true;
                                        myself.imSmallBlind = true;
                                        myself.jetton = user.money - msg.money
                                    }
                                    myself.blind++;
                                }else if(myself.blind === 1  && user.user === msg.user && msg.money === 200){
                                    let seatInfo = new seatInfoService()
                                    seatInfo.user = user.user;
                                    seatInfo.jetton = user.money - msg.money;
                                    seatInfo.money = user.money - msg.money;
                                    seatInfo.isBigBlind = true;
                                    user.isBigBlind = true;
                                    myself.allUserSeatInfo.push(seatInfo)
                                    if(msg.user === config.player.user) {
                                        myself.me.isBigBlind = true;
                                        myself.isBigBlind = true;
                                        myself.jetton = user.money - msg.money
                                    }
                                    myself.blind++;
                                }else if(user.user === msg.user){
                                    user.lastValidAction = msg.wager_type;
                                }
                            })
                            console.log('下注后----------------- allUserInfor', myself.allUserInfor)

                            if(myself.blind===2){
                                onSeatInfo(myself); //下注前先计算位置，大小盲注
                                myself.blind++;
                            }
                            break;
                        case 5:
                            console.log('发公共牌（翻牌，转牌，河牌）', msg);
                            if(msg.public_cards_type == 1 && !myself.checkInFlop){//正在发牌的时候，取到牌并算取概率
                                myself.commonCards = myself.commonCards.concat(msg.cards);
                                let cc = []
                                myself.checkInFlop = true
                                myself.currentTotalCardCount++;
                                myself.commonCards.forEach(function(card){
                                    let c = {};
                                    c.type = parseInt((card - 1)/13) + 1 ;
                                    c.point = parseInt(card %13) == 0 ? 13 : parseInt(card %13);
                                    c.point = c.point===1? 14: c.point;
                                    cc.push(c)
                                });
                                myself.cardType = util.getBiggest(_.cloneDeep(myself.holdCards.concat(cc)));
                                myself.listenType = util.listenCard(_.cloneDeep(myself.holdCards.concat(cc)));
                                console.log('listenType', listenType)
                                if(myself.listenType!=null && myself.listenType.get("handCard").length>1){
                                    myself.iamListeningCard=true;
                                }
                                else if(myself.listenType!=null && myself.listenType.get("handCard").length==1){
                                    if(myself.listenType.get("type")== constant.holdCard.FLUSH){
                                        if(myself.listenType.get("handCard")[0].point >12 ){
                                            myself.iamListeningCard=true;
                                        }
                                    }
                                    if(myself.listenType.get("type")==constant.holdCard.STRAIGHT){
                                        myself.iamListeningCard=true;
                                        for(let i=0;i<listenType.get('publicCard').length;i++){
                                            if(myself.listenType.get("publicCard")[i].point>(myself.listenType.get("handCard")[0].point)){
                                                myself.iamListeningCard=false;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if(myself.listenType.get("type")==constant.holdCard.FLUSH){
                                    if(myself.cardType.get('type') === constant.holdCard.ONE_PAIR){
                                        myself.listenOuts = 11;
                                    }else if(myself.cardType.get('type') === constant.holdCard.TWO_PAIR)
                                        myself.listenOuts = 13;
                                    else myself.listenOuts = 9;
                                }else if(listenType.get("type")==constant.holdCard.STRAIGHT){
                                    if(cardType.get('type') === constant.holdCard.ONE_PAIR){
                                        myself.listenOuts = 10;
                                    }else if(cardType.get('type') === constant.holdCard.TWO_PAIR)
                                        myself.listenOuts = 12;
                                    else myself.listenOuts = 8;
                                }else {
                                    if(myself.cardType.get('type') === constant.holdCard.ONE_PAIR) {
                                        myself.listenOuts = 2;
                                    } else if(myself.cardType.get('type') === constant.holdCard.TWO_PAIR)
                                        myself.listenOuts = 4;
                                    else myself.listenOuts = 0;
                                }
                                myself.myListenWinProba=listenOuts*4*0.01;
                            }else if(msg.public_cards_type == 2 && !checkInTurn){
                                myself.currentTotalCardCount++;
                                myself.commonCards = commonCards.concat(msg.cards);
                                myself.checkInTurn=true;
                                let cc = []
                                myself.commonCards.forEach(function(card){
                                    let c = {};
                                    c.type = parseInt((card - 1)/13) + 1 ;
                                    c.point = parseInt(card %13) == 0 ? 13 : parseInt(card %13);
                                    c.point = c.point===1? 14: c.point;
                                    cc.push(c)
                                });
                                myself.cardType = util.getBiggest(_.cloneDeep(myself.holdCards.concat(cc)));
                                myself.listenType = util.listenCard(_.cloneDeep(myself.holdCards.concat(cc)))
                                console.log('listenType', myself.listenType)
                                if(myself.listenType!=null && myself.listenType.get("handCard").length>1){
                                    myself.iamListeningCard=true;
                                }
                                else if(myself.listenType!=null && myself.listenType.get("handCard").length==1){
                                    if(myself.listenType.get("type")== constant.holdCard.FLUSH){
                                        if(myself.listenType.get("handCard")[0].point >12 ){
                                            myself.iamListeningCard=true;
                                        }
                                    }
                                    if(myself.listenType.get("type")==constant.holdCard.STRAIGHT){
                                        myself.iamListeningCard=true;
                                        for(let i=0;i<listenType.get('publicCard').length;i++){
                                            if(myself.listenType.get("publicCard")[i].point>(myself.listenType.get("handCard")[0].point)){
                                                myself.iamListeningCard=false;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if(myself.listenType.get("type")==constant.holdCard.FLUSH){
                                    if(myself.cardType.get('type') === constant.holdCard.ONE_PAIR){
                                        myself.listenOuts = 11;
                                    }else if(myself.cardType.get('type') === constant.holdCard.TWO_PAIR)
                                        myself.listenOuts = 13;
                                    else myself.listenOuts = 9;
                                }else if(myself.listenType.get("type")==constant.holdCard.STRAIGHT){
                                    if(myself.cardType.get('type') === constant.holdCard.ONE_PAIR){
                                        myself.listenOuts = 10;
                                    }else if(myself.cardType.get('type') === constant.holdCard.TWO_PAIR)
                                        myself.listenOuts = 12;
                                    else myself.listenOuts = 8;
                                }else {
                                    if(myself.cardType.get('type') === constant.holdCard.ONE_PAIR) {
                                        myself.listenOuts = 2;
                                    } else if(myself.cardType.get('type') === constant.holdCard.TWO_PAIR)
                                        myself.listenOuts = 4;
                                    else myself.listenOuts = 0;
                                }
                                myself.myListenWinProba=listenOuts*4*0.01;
                            }else if(msg.public_cards_type == 3 && !myself.checkInRiver){
                                myself.currentTotalCardCount++;
                                myself.commonCards = commonCards.concat(msg.cards);
                                myself.checkInRiver = true;
                                let cc = []
                                commonCards.forEach(function(card){
                                    let c = {};
                                    c.type = parseInt((card - 1)/13) + 1 ;
                                    c.point = parseInt(card %13) == 0 ? 13 : parseInt(card %13);
                                    c.point = c.point===1? 14: c.point;
                                    cc.push(c)
                                });
                                myself.cardType = util.getBiggest(_.cloneDeep(myself.holdCards.concat(cc)));
                                myself.listenType = util.listenCard(_.cloneDeep(myself.holdCards.concat(cc)))
                                console.log('listenType', listenType)
                                if(listenType!=null && listenType.get("handCard").length>1){
                                    myself.iamListeningCard=true;
                                }
                                else if(myself.listenType!=null && myself.listenType.get("handCard").length==1){
                                    if(myself.listenType.get("type")== constant.holdCard.FLUSH){
                                        if(myself.listenType.get("handCard")[0].point >12 ){
                                            myself.iamListeningCard=true;
                                        }
                                    }
                                    if(myself.listenType.get("type")==constant.holdCard.STRAIGHT){
                                        myself.iamListeningCard=true;
                                        for(let i=0;i<myself.listenType.get('publicCard').length;i++){
                                            if(myself.listenType.get("publicCard")[i].point>(myself.listenType.get("handCard")[0].point)){
                                                myself.iamListeningCard=false;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if(myself.listenType.get("type")==constant.holdCard.FLUSH){
                                    if(myself.cardType.get('type') === constant.holdCard.ONE_PAIR){
                                        myself.listenOuts = 11;
                                    }else if(myself.cardType.get('type') === constant.holdCard.TWO_PAIR)
                                        myself.listenOuts = 13;
                                    else myself.listenOuts = 9;
                                }else if(myself.listenType.get("type")==constant.holdCard.STRAIGHT){
                                    if(myself.cardType.get('type') === constant.holdCard.ONE_PAIR){
                                        myself.listenOuts = 10;
                                    }else if(myself.cardType.get('type') === constant.holdCard.TWO_PAIR)
                                        myself.listenOuts = 12;
                                    else myself.listenOuts = 8;
                                }else {
                                    if(myself.cardType.get('type') === constant.holdCard.ONE_PAIR) {
                                        myself.listenOuts = 2;
                                    } else if(myself.cardType.get('type') === constant.holdCard.TWO_PAIR)
                                        myself.listenOuts = 4;
                                    else myself.listenOuts = 0;
                                }
                                myself.myListenWinProba=listenOuts*4*0.01;
                            }
                            console.log('发公共牌（翻牌，转牌，河牌）commonCards', myself.commonCards);
                            break;
                        case 6:
                            console.log('牌局结果');
                            var data = msg.result;
                            for(var i=0;i<data.length;i++){//记录本人的总筹码
                                if(data[i].user == config.player.user){
                                    myself.newMoney = data[i].money;
                                }
                            }
                            myself.holdCards = [], myself.blind = 0;
                            myself.allUserInfor = [],//记录所有玩家信息
                                myself.totalUser = 0,
                                myself.gameStatus = 0,
                                myself.statusFlag = 1,
                                myself.commonCards = [];
                            myself.imSmallBlind=false, myself.imBigBlind=false,myself.checkInFlop = false,myself.checkInTurn = false,myself.checkInRiver = false, myself.checkPreFlop = false;myself.cardType = null, myself.listenOuts = null;
                            myself.oneHasAllIn = false, myself.listenType=null,myself.iamListeningCard = false;myself.winrate = 0;myself.allUserSeatInfo = [],myself.preflopThreshold={},myself.myListenWinProba = 0;myself.totalPot = 0;
                            requstUserInfo(1)
                            break;
                    }
                }
            }
        }
    })
};

function changeCards(cards){
    let count = []
    cards.forEach(function(card){
        let n = 0;
        n += (card.type - 1)*13;
        if(card.point === 14){
            card.point = 1
        }
        n += card.point;
        count.push(n)
    });
    return count;
}

function showdown(token, cards) {
    if(_.isEmpty(cards)){
        cards[0] = '';
        cards[1] = '';
        cards[2] = '';
    }
    let criteria = {
        deskid: config.player.deskid,
        token: token,
        card1: cards[0],
        card2: cards[1],
        card3: cards[2],
    }
    playerService.showdown(criteria, function(err, result){
        if(err) return {};
        else{
            console.log(result)
        }
    })
};

function onSeatInfo(player) {
    console.log('in onSeatInfo=====================')
    opponentGoodHandsNum = 0;
    opponentGoodFlopLvl1Num = 0;
    opponentGoodTurnLvl1Num = 0;
    opponentGoodRiverLvl1Num = 0;
    flopInqNum = 0;

    myself.link.setPlayerOfMe(myself);
    myself.link.add(_.find(myself.allUserSeatInfo, {isSmallBlind: true}));
    myself.link.add(_.find(myself.allUserSeatInfo, {isBigBlind: true}));
    myself.allUserInfor.forEach(function (user) {
        if (!user.isSmallBlind && !user.isBigBlind) {
            let seatInfo = new seatInfoService();
            seatInfo.user = user.user;
            seatInfo.jetton = user.money;
            seatInfo.money = user.money;
            seatInfo.bet = user.wager;
            if(user.user_status==4) seatInfo.isFold = true;
            else if(user.user_status==5) seatInfo.isAllin = true;
            myself.allUserSeatInfo.push(seatInfo)
            console.log('seatInfo user', seatInfo.user)
            myself.link.add(seatInfo)
        }
    })
    // console.log('in onSeatInfo link GetSmallBlindSeat', link.GetSmallBlindSeat())
    let positionIndex = 0;
    myself.link.seek(myself.link.GetSmallBlind());	//定位到小盲注的位置
    if (!myself.playerStatisticTable.has(myself.link.CurrentSeat().user)) {
        myself.playerStatisticTable.set(myself.link.CurrentSeat().user, new playerStatisticService());
    }
    // myself.money_1st=link.CurrentSeat().jetton + link.CurrentSeat().money;
    myself.money_1st = myself.link.CurrentSeat().jetton;
    myself.link.CurrentSeat().positionIndex = positionIndex++;

    //下注量
    console.log('下注量----11111-------- myself.playNum', myself.playNum)
    let avgPreflopBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgPreflopBet(myself.playNum - 1, constant.PREFLOP_THRESHOLD_CALC_NUM),
        avgFlopBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgFlopBet(myself.playNum - 1, constant.FLOP_THRESHOLD_CALC_NUM),
        avgTurnBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgTurnBet(myself.playNum - 1, myself.playNum - 1),
        avgRiverBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgRiverBet(myself.playNum - 1, myself.playNum - 1),
        maxAvgBet = 0,

        medianPreflopBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianPreflopBet(myself.playNum - 1, constant.PREFLOP_THRESHOLD_CALC_NUM),
        medianFlopBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianFlopBet(myself.playNum - 1, constant.FLOP_THRESHOLD_CALC_NUM),
        medianTurnBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianTurnBet(myself.playNum - 1, myself.playNum - 1),
        medianRiverBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianRiverBet(myself.playNum - 1, myself.playNum - 1),
        maxMedianBet = 0;

    if (avgFlopBet > maxAvgBet)
        maxAvgBet = avgFlopBet;
    if (avgTurnBet > maxAvgBet)
        maxAvgBet = avgTurnBet;
    if (avgRiverBet > maxAvgBet)
        maxAvgBet = avgRiverBet;

    if (medianFlopBet > maxMedianBet)
        maxMedianBet = medianFlopBet;
    if (medianTurnBet > maxMedianBet)
        maxMedianBet = medianTurnBet;
    if (medianRiverBet > maxMedianBet)
        maxMedianBet = medianRiverBet;

    myself.link.CurrentSeat().UpdatePreflopThreshold(avgPreflopBet, medianPreflopBet, bigBlindBet);
    myself.link.CurrentSeat().UpdateFlopThreshold(avgFlopBet, medianFlopBet, bigBlindBet);
    myself.link.CurrentSeat().UpdateTurnThreshold(avgTurnBet, medianTurnBet, bigBlindBet);
    myself.link.CurrentSeat().UpdateRiverThreshold(avgRiverBet, medianRiverBet, bigBlindBet);

    //加注量
    console.log('加注量----11111--------')
    let avgPreflopRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgPreflopRaiseBet(myself.playNum - 1, constant.PREFLOP_THRESHOLD_CALC_NUM),
        avgFlopRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgFlopRaiseBet(myself.playNum - 1, constant.FLOP_THRESHOLD_CALC_NUM),
        avgTurnRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgTurnRaiseBet(myself.playNum - 1, myself.playNum - 1),
        avgRiverRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgRiverRaiseBet(myself.playNum - 1, myself.playNum - 1),
        maxAvgRaiseBet = 0,
        medianPreflopRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianPreflopRaiseBet(myself.playNum - 1, constant.PREFLOP_THRESHOLD_CALC_NUM),
        medianFlopRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianFlopRaiseBet(myself.playNum - 1, constant.FLOP_THRESHOLD_CALC_NUM),
        medianTurnRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianTurnRaiseBet(myself.playNum - 1, myself.playNum - 1),
        medianRiverRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianRiverRaiseBet(myself.playNum - 1, myself.playNum - 1),
        maxMedianRaiseBet = 0;

    if (avgFlopRaiseBet > maxAvgRaiseBet)
        maxAvgRaiseBet = avgFlopRaiseBet;
    if (avgTurnRaiseBet > maxAvgRaiseBet)
        maxAvgRaiseBet = avgTurnRaiseBet;
    if (avgRiverRaiseBet > maxAvgRaiseBet)
        maxAvgRaiseBet = avgRiverRaiseBet;

    if (medianFlopRaiseBet > maxMedianRaiseBet)
        maxMedianRaiseBet = medianFlopRaiseBet;
    if (medianTurnRaiseBet > maxMedianRaiseBet)
        maxMedianRaiseBet = medianTurnRaiseBet;
    if (medianRiverRaiseBet > maxMedianRaiseBet)
        maxMedianRaiseBet = medianRiverRaiseBet;
    console.log('加注量----22222222222--------')
    myself.link.CurrentSeat().UpdatePreflopRaiseThreshold(avgPreflopRaiseBet, medianPreflopRaiseBet, bigBlindBet);
    myself.link.CurrentSeat().UpdateFlopRaiseThreshold(avgFlopRaiseBet, medianFlopRaiseBet, bigBlindBet);
    myself.link.CurrentSeat().UpdateTurnRaiseThreshold(avgTurnRaiseBet, medianTurnRaiseBet, bigBlindBet);
    myself.link.CurrentSeat().UpdateRiverRaiseThreshold(avgRiverRaiseBet, medianRiverRaiseBet, bigBlindBet);

    //入局率

    myself.link.CurrentSeat().incomingRate = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getIncomingRate(myself.playNum - 1, myself.playNum - 1);

    while (myself.link.curNextSeat().user.toString() !== myself.link.GetSmallBlindSeat().user.toString()) {
        if (!myself.playerStatisticTable.has(myself.link.CurrentSeat().user)) {
            myself.playerStatisticTable.set(myself.link.CurrentSeat().user, new playerStatisticService());
        }
        //记录当前的前3名的财富值
        if (myself.link.CurrentSeat().jetton > myself.money_1st) {
            myself.money_3rd = myself.money_2nd;
            myself.money_2nd = myself.money_1st;
            myself.money_1st = myself.link.CurrentSeat().jetton;
        }
        else if (myself.link.CurrentSeat().jetton > myself.money_2nd) {
            myself.money_3rd = myself.money_2nd;
            myself.money_2nd = myself.link.CurrentSeat().jetton;
        }
        else if (myself.link.CurrentSeat().jetton > myself.money_3rd) {
            myself.money_3rd = myself.link.CurrentSeat().jetton;
        }
        //将每个玩家的说话顺序记录下来
        console.log('将每个玩家的说话顺序记录下来')
        myself.link.CurrentSeat().positionIndex = positionIndex;
        positionIndex++
        //下注量
        avgPreflopBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgPreflopBet(myself.playNum - 1, myself.playNum - 1);
        avgFlopBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgFlopBet(myself.playNum - 1, myself.playNum - 1);
        avgTurnBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgTurnBet(myself.playNum - 1, myself.playNum - 1);
        avgRiverBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgRiverBet(myself.playNum - 1, myself.playNum - 1);
        maxAvgBet = 0;
        medianPreflopBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianPreflopBet(myself.playNum - 1, myself.playNum - 1);
        medianFlopBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianFlopBet(myself.playNum - 1, myself.playNum - 1);
        medianTurnBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianTurnBet(myself.playNum - 1, myself.playNum - 1);
        medianRiverBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianRiverBet(myself.playNum - 1, myself.playNum - 1);
        maxMedianBet = 0;
        if (avgFlopBet > maxAvgBet)
            maxAvgBet = avgFlopBet;
        if (avgTurnBet > maxAvgBet)
            maxAvgBet = avgTurnBet;
        if (avgRiverBet > maxAvgBet)
            maxAvgBet = avgRiverBet;
        if (medianFlopBet > maxMedianBet)
            maxMedianBet = medianFlopBet;
        if (medianTurnBet > maxMedianBet)
            maxMedianBet = medianTurnBet;
        if (medianRiverBet > maxMedianBet)
            maxMedianBet = medianRiverBet;

        myself.link.CurrentSeat().UpdatePreflopThreshold(avgPreflopBet, medianPreflopBet, bigBlindBet);
        myself.link.CurrentSeat().UpdateFlopThreshold(avgFlopBet, medianFlopBet, bigBlindBet);
        myself.link.CurrentSeat().UpdateTurnThreshold(avgTurnBet, medianTurnBet, bigBlindBet);
        myself.link.CurrentSeat().UpdateRiverThreshold(avgRiverBet, medianRiverBet, bigBlindBet);
        //加注量
        avgPreflopRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgPreflopRaiseBet(myself.playNum - 1, myself.playNum - 1);
        avgFlopRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgFlopRaiseBet(myself.playNum - 1, myself.playNum - 1);
        avgTurnRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgTurnRaiseBet(myself.playNum - 1, myself.playNum - 1);
        avgRiverRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getAvgRiverRaiseBet(myself.playNum - 1, myself.playNum - 1);
        maxAvgRaiseBet = 0;
        medianPreflopRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianPreflopRaiseBet(myself.playNum - 1, myself.playNum - 1);
        medianFlopRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianFlopRaiseBet(myself.playNum - 1, myself.playNum - 1);
        medianTurnRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianTurnRaiseBet(myself.playNum - 1, myself.playNum - 1);
        medianRiverRaiseBet = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getMedianRiverRaiseBet(myself.playNum - 1, myself.playNum - 1);
        maxMedianRaiseBet = 0;
        if (avgFlopRaiseBet > maxAvgRaiseBet)
            maxAvgRaiseBet = avgFlopRaiseBet;
        if (avgTurnRaiseBet > maxAvgRaiseBet)
            maxAvgRaiseBet = avgTurnRaiseBet;
        if (avgRiverRaiseBet > maxAvgRaiseBet)
            maxAvgRaiseBet = avgRiverRaiseBet;
        if (medianFlopRaiseBet > maxMedianRaiseBet)
            maxMedianRaiseBet = medianFlopRaiseBet;
        if (medianTurnRaiseBet > maxMedianRaiseBet)
            maxMedianRaiseBet = medianTurnRaiseBet;
        if (medianRiverRaiseBet > maxMedianRaiseBet)
            maxMedianRaiseBet = medianRiverRaiseBet;

        myself.link.CurrentSeat().UpdatePreflopRaiseThreshold(avgPreflopRaiseBet, medianPreflopRaiseBet, bigBlindBet);
        myself.link.CurrentSeat().UpdateFlopRaiseThreshold(avgFlopRaiseBet, medianFlopRaiseBet, bigBlindBet);
        myself.link.CurrentSeat().UpdateTurnRaiseThreshold(avgTurnRaiseBet, medianTurnRaiseBet, bigBlindBet);
        myself.link.CurrentSeat().UpdateRiverRaiseThreshold(avgRiverRaiseBet, medianRiverRaiseBet, bigBlindBet);

        //入局率
        myself.link.CurrentSeat().incomingRate = myself.playerStatisticTable.get(myself.link.CurrentSeat().user).getIncomingRate(myself.playNum - 1, myself.playNum - 1);

    }
        myself.playerStatisticTable.forEach(function (value, key) {
            value.preflopRaiseNumFlag = false;
            value.flopRaiseNumFlag = false;
            value.turnRaiseNumFlag = false;
            value.riverRaiseNumFlag = false;
            value.isWatchedMap.set(0, false).set(1, false).set(2, false);
            value.preflopBet.push(-1);
            value.flopBet.push(-1);
            value.turnBet.push(-1);
            value.preflopBet.push(-1);
            value.preflopRaiseBet.push(-1);
            value.flopRaiseBet.push(-1);
            value.turnRaiseBet.push(-1);
            value.riverRaiseBet.push(-1);
        })
        myself.state = constant.state.PreFlop;
        myself.state_ff1 = constant.state.PreFlop;
    myself.link.seek(myself.link.Me());	//定位到自己的位置
    myself.link.CurrentSeat().preflopBet = -1;
    myself.link.CurrentSeat().flopBet = -1;
    myself.link.CurrentSeat().turnBet = -1;
    myself.link.CurrentSeat().riverBet = -1;
        while (myself.link.curNextSeat().user !== myself.link.MySeat().user) {
            myself.link.CurrentSeat().preflopBet = -1;
            myself.link.CurrentSeat().flopBet = -1;
            myself.link.CurrentSeat().turnBet = -1;
            myself.link.CurrentSeat().riverBet = -1;
            myself.link.CurrentSeat().preflopRaiseBet = -1;
            myself.link.CurrentSeat().flopRaiseBet = -1;
            myself.link.CurrentSeat().turnRaiseBet = -1;
            myself.link.CurrentSeat().riverRaiseBet = -1;
        }
        //如果游戏刚刚开始，那么计算所有玩家的总钱数
        console.log('如果游戏刚刚开始')
        if (myself.playNum === 1) {
            myself.totalMoneyPerPlayer = myself.link.MySeat().jetton;
            myself.initJetton = myself.link.MySeat().jetton;
            myself.totalMoney = myself.totalMoneyPerPlayer * myself.link.GetPlayerNum();
        }
        myself.preflopRaiseCnt = 0;
        myself.flopRaiseCnt = 0;
        myself.turnRaiseCnt = 0;
        myself.riverRaiseCnt = 0;
        myself.preflopLoseProba = 1;
        myself.flopLoseProba = 1;
        myself.turnLoseProba = 1;
        myself.riverLoseProba = 1;
        console.log('end =====================', myself.totalMoney)
}


function GetPreFlopThreshold_loose(){
    console.log('in GetPreFlopThreshold_loose')
//浮点计算的精确度
    let precision = 0.01,
    raiseThreshold=0,
    followThreshold=0,
        myJetton= myself.link.MySeat().jetton,
    gameLvl=Math.max((myJetton + myself.link.MySeat().bet)/100000/2,1),
    betUnit = myself.leastRaiseBet + precision,
    isSuite=0;
    if(myself.holdCards[0].type === myself.holdCards[1].type)
        isSuite=1;
    let myWinProba=constant.handProbaTable[isSuite][myself.holdCards[0].point][myself.holdCards[1].point];
    doSomething(betUnit);
    handLvl = constant.handProbaTable[isSuite][myself.holdCards[0].point][myself.holdCards[1].point];
    //如果在靠后的位置
    console.log(' GetPreFlopThreshold_loose handLvl ', handLvl)
    if(2>backNum && frontNum>backNum){
        console.log('如果在靠后的位置')
        //手牌为对A
        if(myWinProba>0.67){
            //加注进入
            if(opponentGoodHandsNum==0){
                raiseThreshold=betUnit;
                followThreshold=myself.link.MySeat().jetton + precision;
            }
            else{
                raiseThreshold=100*2;
                followThreshold=myself.link.MySeat().jetton+precision;
            }
        } else if(myWinProba>0.6){
            //加注进入
            console.log('加注进入')
            if(opponentGoodHandsNum==0){
                raiseThreshold=betUnit;
                followThreshold=myself.link.MySeat().jetton+precision;
            } else{
                raiseThreshold=3*betUnit;
                followThreshold=10*betUnit;
            }
        }//手牌为AKs AQs AKo
        else if(myWinProba>0.52){
            //加注进入
            if(opponentGoodHandsNum==0){
                raiseThreshold=betUnit;
                followThreshold=myself.link.MySeat().jetton+precision;
            } else{
                raiseThreshold=2*betUnit;
                followThreshold=5*betUnit;
            }
        }
        //A加大牌
        else if (myWinProba>0.5){
            //加注进入
            if(opponentGoodHandsNum==0){
                raiseThreshold=betUnit;
                followThreshold=myself.link.MySeat().jetton+precision;
            } else{
                raiseThreshold=betUnit;
                followThreshold=5*betUnit;
            }
        } else if(handLvl<=handLvlThreshold){
            //加注进入
            if(opponentGoodHandsNum==0 && backCrazyOpponentNum==0){
                raiseThreshold=betUnit;
                followThreshold=2*betUnit;
            } else{
                raiseThreshold=betUnit;
                followThreshold=3*betUnit;
            }
        }
    }
    //如果在靠前的位置
    else{
        console.log('如果在靠前的位置')
        //手牌为对A
        console.log('手牌为对A')
        if(myWinProba>0.67){
            //加注进入
            if(opponentGoodHandsNum==0){
                raiseThreshold=betUnit;
                followThreshold=myself.link.MySeat().jetton+precision;
            } else{
                raiseThreshold=100*2;
                followThreshold=myself.link.MySeat().jetton+precision;
            }
        } else if(myWinProba>0.6){
            //加注进入
            if(opponentGoodHandsNum==0){
                raiseThreshold=betUnit;
                followThreshold=myself.link.MySeat().jetton+precision;
            }
            else{
                raiseThreshold=3*betUnit;
                followThreshold=10*betUnit;
            }
        }
        //手牌为AKs AQs AKo
        else if(myWinProba>0.52){
            console.log('手牌为AKs AQs AKo')
            //加注进入
            if(opponentGoodHandsNum==0){
                raiseThreshold=betUnit;
                followThreshold=myself.link.MySeat().jetton+precision;
            }
            else{
                raiseThreshold=2*betUnit;
                followThreshold=5*betUnit;
            }
        }
        //A加大牌
        else if (myWinProba>0.5){
            console.log('A加大牌')
            //加注进入
            if(opponentGoodHandsNum==0){
                raiseThreshold=betUnit;
                followThreshold=myself.link.MySeat().jetton+precision;
            } else{
                raiseThreshold=betUnit;
                followThreshold=5*betUnit;
            }
        } else if(handLvl<=handLvlThreshold){
            console.log('加注进入')
            //加注进入
            if(opponentGoodHandsNum==0 && backCrazyOpponentNum==0){
                raiseThreshold=0;
                followThreshold=2*betUnit;
            }
            else{
                raiseThreshold=0;
                followThreshold=3*betUnit;
            }
        }
    }
    return {raiseThreshold: raiseThreshold,followThreshold: followThreshold};
}

function GetFlopThreshold_ungar() {
    //浮点计算的精确度
    let precision= 0.01,
    raiseThreshold=0,
    followThreshold=0,
    myJetton = myMoney,
    gameLvl=Math.max((myJetton + wager)/100000/2,1),
    betUnit=100+precision,
    isSuite=0;
    if(myself.holdCards[0].type===myself.holdCards[1].type)
        isSuite=1;
    let myHandWinProba = constant.handProbaTable[isSuite][getHoldCard1().getPoint().point()][getHoldCard2().getPoint().point()],
        cardProba = 0.45,
        myCardType = util.getBiggest(cards),
        myListenType = util.listenCard(cards);

    if(myListenType!==null && myListenType.get("handCard").length>1){
        myself.iamListeningCard=true;
    } else if(myListenType!==null && myListenType.get("handCard").length===1){
        if(myListenType.get("type")===constant.holdCard.FLUSH){
            if(myListenType.get("handCard")[0].point > 12){
                myself.iamListeningCard=true;
            }
        }
        if(myListenType.get("type")===constant.holdCard.STRAIGHT){
            myself.iamListeningCard=true;
            for(let i=0;i<myListenType.get("publicCard").length;i++){
                if(myListenType.get("publicCard")[0].point>myListenType.get("handCard")[0].point()){
                    myself.iamListeningCard=false;
                    break;
                }
            }
        }
    }
    let listenOuts=0, myListenWinProba=0;
    if(myListenType!=null && myListenType.get("type")===constant.holdCard.FLUSH){
        if(myCardType.get("type")===constant.holdCard.ONE_PAIR && cardProba[0].GetWinProba()>0.70){
            listenOuts=11;
        }else if(myCardType.get("type")===constant.holdCard.TWO_PAIR && cardProba[0].GetWinProba()>0.70){
            listenOuts=13;
        }else{
            listenOuts=9;
        }
    } else if(myListenType!==null && myListenType.get("type")===constant.holdCard.STRAIGHT){
        if(myCardType.get("type")===constant.holdCard.ONE_PAIR && cardProba[0].GetWinProba()>0.70){
            listenOuts=10;
        } else if(myCardType.get("type")===constant.holdCard.TWO_PAIR && cardProba[0].GetWinProba()>0.70){
            listenOuts=12;
        } else{
            listenOuts=8;
        }
    } else{
        if(myCardType.get("type")===constant.holdCard.ONE_PAIR && cardProba[0].GetWinProba()>0.70){
            listenOuts=2;
        }else if(myCardType.get("type")===constant.holdCard.TWO_PAIR && cardProba[0].GetWinProba()>0.70){
            listenOuts=4;
        }else{
            listenOuts=0;
        }
    }
    myListenWinProba=listenOuts*4*0.01;
    let myWinProba = 1;
    doSomething();

    //概率调整，如果推测对手有好的起手，就按照松紧概率中的较大者概率来算
    if(opponentGoodHandsNum>0 && avtivePlayers<3){
        myWinProba=cardProba[1].GetWinProba()+cardProba[1].GetDrawProba();
    }
    if(opponentGoodHandsNum>0){
        myWinProba=Math.min(cardProba[0].GetWinProba()+cardProba[0].GetDrawProba(), cardProba[1].GetWinProba()+cardProba[1].GetDrawProba());
    } else{
        myWinProba=cardProba[0].GetWinProba()+cardProba[0].GetDrawProba();
    }
    if(opponentGoodFlopLvl1Num>1){
        if(myWinProba>0.999){
            raiseThreshold=playerLink.MySeat().getJetton()+precision;
            followThreshold=playerLink.MySeat().getJetton()+precision;
        } else if(myWinProba>0.95){
            raiseThreshold=0;
            followThreshold=playerLink.MySeat().getJetton()+precision;
        } else if(myWinProba>0.90){
            raiseThreshold=0;
            let winLoseRate=myListenWinProba/(1-myListenWinProba);
            followThreshold=Math.max(winLoseRate*totalPot, 0.4*totalPot);
        } else{
            raiseThreshold=0;
            let winLoseRate=myListenWinProba/(1-myListenWinProba);
            followThreshold=Math.max(winLoseRate*totalPot, 0.1*totalPot);
        }
    } else if(opponentGoodFlopLvl1Num>0){
        if(myWinProba>0.999){
            raiseThreshold=Math.max(totalPot, betUnit);
            followThreshold=playerLink.MySeat().getJetton()+precision;
        } else if(myWinProba>0.95){
            raiseThreshold=Math.max(0.3*totalPot, betUnit);
            followThreshold=playerLink.MySeat().getJetton()+precision;
        } else if(myWinProba>0.90){
            raiseThreshold=Math.max(0.3*totalPot, betUnit);
            followThreshold=0.8*totalPot;
        } else if(myWinProba>0.80){
            raiseThreshold=Math.max(0.2*totalPot, betUnit);
            followThreshold=0.5*totalPot;
        } else if(myWinProba>0.70){
            raiseThreshold=0;
            let winLoseRate=myListenWinProba/(1-myListenWinProba);
            followThreshold=Math.max(winLoseRate*totalPot, 0.4*totalPot);
        } else{
            raiseThreshold=0;
            let winLoseRate=myListenWinProba/(1-myListenWinProba);
            followThreshold=Math.max(winLoseRate*totalPot, 0.1*totalPot);
        }
    }
    else{
        if(myWinProba>0.999){
            raiseThreshold=Math.max(0.3*totalPot, betUnit);
            followThreshold=playerLink.MySeat().getJetton()+precision;
        }
        else if(myWinProba>0.95){
            raiseThreshold=Math.max(0.3*totalPot, betUnit);
            followThreshold=playerLink.MySeat().getJetton()+precision;
        }
        else if(myWinProba>0.75){
            raiseThreshold=Math.max(0.2*totalPot, betUnit);
            let winLoseRate=myListenWinProba/(1-myListenWinProba);
            followThreshold=Math.max(winLoseRate*totalPot, 0.75*totalPot);
        }
        else if(myWinProba>0.60){
            raiseThreshold=0.25*totalPot;
            let winLoseRate=myListenWinProba/(1-myListenWinProba);
            followThreshold=Math.max(winLoseRate*totalPot, 0.6*totalPot);
        }
        else if(myWinProba>0.50){
            if(iamListeningCard){
                raiseThreshold=Math.max(0.2*totalPot, betUnit);
                let winLoseRate=myListenWinProba/(1-myListenWinProba);
                followThreshold=Math.max(winLoseRate*totalPot, 0.5*totalPot);
            }
            else{
                raiseThreshold=0;
                let winLoseRate=myListenWinProba/(1-myListenWinProba);
                followThreshold=Math.max(winLoseRate*totalPot, 0.4*totalPot);
            }
        }
        else {
            if(iamListeningCard){
                raiseThreshold=Math.max(0.2*totalPot, betUnit);
                let winLoseRate=myListenWinProba/(1-myListenWinProba);
                followThreshold=Math.max(winLoseRate*totalPot, myWinProba*totalPot);
            }
            else{
                raiseThreshold=0;
                let winLoseRate=myListenWinProba/(1-myListenWinProba);
                followThreshold=Math.max(winLoseRate*totalPot, 0.2*totalPot);
            }
        }
    }
    return {raiseThreshold: raiseThreshold, followThreshold: followThreshold};
}

function doSomething(betUnit){
    console.log('in doSomething')
    myself.link.seek(myself.link.Me());
    let curSeat = new seatInfoService();
    curSeat = myself.link.GetNextActive();
    console.log('in doSomething curSeat', curSeat)
    while(curSeat !== null && !curSeat.user===myself.link.MySeat().user){
        //preflop
        oppoPreflopBet=curSeat.preflopBet;
        if(minOppoPreflopBet>oppoPreflopBet){
            minOppoPreflopBet=oppoPreflopBet;
        }
        if(oppoPreflopBet>maxOppoPreflopBet){
            maxOppoPreflopBet=oppoPreflopBet;
        }
        if(minPreflopLvl1Threshold>curSeat.preflopLvl1Threshold){
            minPreflopLvl1Threshold=curSeat.preflopLvl1Threshold;
        }
        if(maxPreflopLvl1Threshold<curSeat.preflopLvl1Threshold){
            maxPreflopLvl1Threshold=curSeat.preflopLvl1Threshold;
        }
        //所有对手中最大的加注量阈值
        if(minPreflopRaiseLvl1Threshold>curSeat.preflopRaiseLvl1Threshold){
            minPreflopRaiseLvl1Threshold=curSeat.preflopRaiseLvl1Threshold;
        }
        if(maxPreflopRaiseLvl1Threshold<curSeat.preflopRaiseLvl1Threshold){
            maxPreflopRaiseLvl1Threshold=curSeat.preflopRaiseLvl1Threshold;
        }
        //flop
        oppoFlopBet=curSeat.flopBet;
        if(minOppoFlopBet>oppoFlopBet){
            minOppoFlopBet=oppoFlopBet;
        }
        if(oppoFlopBet>maxOppoFlopBet){
            maxOppoFlopBet=oppoFlopBet;
        }
        if(minFlopLvl1Threshold>curSeat.flopLvl1Threshold){
            minFlopLvl1Threshold=curSeat.flopLvl1Threshold;
        }
        if(maxFlopLvl1Threshold<curSeat.flopLvl1Threshold){
            maxFlopLvl1Threshold=curSeat.flopLvl1Threshold;
        }
        if(minFlopLvl2Threshold>curSeat.flopLvl2Threshold){
            minFlopLvl2Threshold=curSeat.flopLvl2Threshold;
        }
        if(maxFlopLvl2Threshold<curSeat.flopLvl2Threshold){
            maxFlopLvl2Threshold=curSeat.flopLvl2Threshold;
        }
        //所有对手中最大的加注量阈值
        if(minFlopRaiseLvl1Threshold>curSeat.flopRaiseLvl1Threshold){
            minFlopRaiseLvl1Threshold=curSeat.flopRaiseLvl1Threshold;
        }
        if(maxFlopRaiseLvl1Threshold<curSeat.flopRaiseLvl1Threshold){
            maxFlopRaiseLvl1Threshold=curSeat.flopRaiseLvl1Threshold;
        }
        if(minFlopRaiseLvl2Threshold>curSeat.flopRaiseLvl2Threshold){
            minFlopRaiseLvl2Threshold=curSeat.flopRaiseLvl2Threshold;
        }
        if(maxFlopRaiseLvl2Threshold<curSeat.flopRaiseLvl2Threshold){
            maxFlopRaiseLvl2Threshold=curSeat.flopRaiseLvl2Threshold;
        }
        //turn
        oppoTurnBet=curSeat.turnBet;
        if(minOppoTurnBet>oppoTurnBet){
            minOppoTurnBet=oppoTurnBet;
        }
        if(oppoTurnBet>maxOppoTurnBet){
            maxOppoTurnBet=oppoTurnBet;
        }
        if(minTurnLvl1Threshold>curSeat.turnLvl1Threshold){
            minTurnLvl1Threshold=curSeat.turnLvl1Threshold;
        }
        if(maxTurnLvl1Threshold<curSeat.turnLvl1Threshold){
            maxTurnLvl1Threshold=curSeat.turnLvl1Threshold;
        }
        if(minTurnLvl2Threshold>curSeat.turnLvl2Threshold){
            minTurnLvl2Threshold=curSeat.turnLvl2Threshold;
        }
        if(maxTurnLvl2Threshold<curSeat.turnLvl2Threshold){
            maxTurnLvl2Threshold=curSeat.turnLvl2Threshold;
        }
        //所有对手中最大的加注量阈值
        if(minTurnRaiseLvl1Threshold>curSeat.turnRaiseLvl1Threshold){
            minTurnRaiseLvl1Threshold=curSeat.turnRaiseLvl1Threshold;
        }
        if(maxTurnRaiseLvl1Threshold<curSeat.turnRaiseLvl1Threshold){
            maxTurnRaiseLvl1Threshold=curSeat.turnRaiseLvl1Threshold;
        }
        if(minTurnRaiseLvl2Threshold>curSeat.turnRaiseLvl2Threshold){
            minTurnRaiseLvl2Threshold=curSeat.turnRaiseLvl2Threshold;
        }
        if(maxTurnRaiseLvl2Threshold<curSeat.turnRaiseLvl2Threshold){
            maxTurnRaiseLvl2Threshold=curSeat.turnRaiseLvl2Threshold;
        }
        //river
        oppoRiverBet=curSeat.riverBet;
        if(minOppoRiverBet>oppoRiverBet){
            minOppoRiverBet=oppoRiverBet;
        }
        if(oppoRiverBet>maxOppoRiverBet){
            maxOppoRiverBet=oppoRiverBet;
        }
        if(minRiverLvl1Threshold>curSeat.riverLvl1Threshold){
            minRiverLvl1Threshold=curSeat.riverLvl1Threshold;
        }
        if(maxRiverLvl1Threshold<curSeat.riverLvl1Threshold){
            maxRiverLvl1Threshold=curSeat.riverLvl1Threshold;
        }
        //所有对手中最大的加注量阈值
        if(minRiverRaiseLvl1Threshold>curSeat.riverRaiseLvl1Threshold){
            minRiverRaiseLvl1Threshold=curSeat.riverRaiseLvl1Threshold;
        }
        if(maxRiverRaiseLvl1Threshold<curSeat.riverRaiseLvl1Threshold){
            maxRiverRaiseLvl1Threshold=curSeat.riverRaiseLvl1Threshold;
        }
        if(curSeat.preflopLvl1Threshold>5*betUnit){
            crazyOpponentNum++;
        }
        if(myself.link.MySeat().positionIndex > curSeat.positionIndex){
            frontNum++;
        } else{
            backNum++;
            if(oppoPreflopBet>=Math.max(curSeat.preflopLvl1Threshold, myself.bigBlindBet)){
                curSeat.hasGoodHand = true;
                backGoodHandsNum++;
            }
        }
        //位置统计
        if(myself.link.MySeat().isBigBlind || (myself.link.MySeat().isSmallBlind && !myself.link.MySeat().isBigBlind) || (myself.link.MySeat().position>curSeat.position && !curSeat.isBigBlind && !curSeat.isSmallBlind)){
            preflopFrontNum++;
        } else{
            preflopBackNum++;
            if(curSeat.preflopLvl1Threshold>5*betUnit){
                backCrazyOpponentNum++;
            }
        }
        if(curSeat.preflopBet>precision){
            if(oppoPreflopBet>=Math.max(curSeat.preflopLvl1Threshold(), myself.bigBlindBet)){
                curSeat.hasGoodHand = true;
                opponentGoodHandsNum++;
            }
            if(oppoFlopBet>=Math.max(curSeat.flopLvl1Threshold, myself.bigBlindBet)){
                curSeat.hasGoodFlopLvl1 = true;
                opponentGoodFlopLvl1Num++;
            }
            if(oppoTurnBet>=Math.max(curSeat.getTurnLvl1Threshold(), myself.bigBlindBet)){
                curSeat.hasGoodTurnLvl1 = true;
                opponentGoodTurnLvl1Num++;
            }
            if(oppoRiverBet>=Math.max(curSeat.getRiverLvl1Threshold(), myself.bigBlindBet)){
                curSeat.hasGoodRiverLvl1 = true;
                opponentGoodRiverLvl1Num++;
            }
        }
        curSeat = myself.link.GetNextActive();
        console.log('end curSeat', curSeat)
    }
}

function updatePlayerStatisticTable(curSeat, state){
    if(state==2){
        //如果弃牌了，就保留-1，否则赋予preflopBet新的值
        if(curSeat.isFold==false){
            curSeat.preflopBet = curSeat.bet;
            if(curSeat.preflopRaiseBet==-1){
                curSeat.preflopRaiseBet = 0;
            }
        }
        //统计表加入最新的数据
        console.log('in updatePlayerStatisticTable myself.playNum', myself.playNum)
        myself.playerStatisticTable.get(curSeat.user).setPreflopBet(myself.playNum, curSeat.preflopBet);
        if(_.find(myself.allUserInfor, {'user': curSeat.user}).lastValidAction == 5){  //加注
            //加注的量
            curSeat.preflopRaiseBet = curSeat.bet;
            //统计表加入最新的数据
            myself.playerStatisticTable.get(curSeat.user).setPreflopRaiseBet(myself.playNum, curSeat.preflopRaiseBet);

            if(myself.playerStatisticTable.get(curSeat.user).preflopRaiseNumFlag==false){
                myself.playerStatisticTable.get(curSeat.user).preflopRaiseNum++;
            }
            if(curSeat.user > myself.playerStatisticTable.get(curSeat.user).getRaiseMax(constant.state.PreFlop)){
                myself.playerStatisticTable.get(curSeat.user).setRaiseMax(constant.state.PreFlop, curSeat.bet);
            }
        }
        else if(_.find(myself.allUserInfor, {'user': curSeat.user}).lastValidAction == 4){
            if(curSeat.bet > myself.playerStatisticTable.get(curSeat.user).getFollowMax(constant.state.PreFlop)){
                myself.playerStatisticTable.get(curSeat.user).setFollowMax(constant.state.PreFlop, curSeat.bet);
            }
        }
    } else if(state == 4){
        if(curSeat.isFold==false){
            curSeat.flopBet = curSeat.bet-curSeat.preflopBet;
            if(curSeat.flopRaiseBet==-1){
                curSeat.flopRaiseBet = 0;
            }
        }
        myself.playerStatisticTable.get(curSeat.user).setFlopBet(myself.playNum, curSeat.flopBet);

        if(_.find(myself.allUserInfor, {'user': curSeat.user}).lastValidAction == 5){
            //加注的量
            curSeat.flopRaiseBet = curSeat.bet - curSeat.preflopBet;
            //统计表加入最新的数据
            myself.playerStatisticTable.get(curSeat.user).setFlopRaiseBet(myself.playNum, curSeat.flopRaiseBet);

            if(myself.playerStatisticTable.get(curSeat.user).isFlopRaiseNumFlag()==false){
                myself.playerStatisticTable.get(curSeat.user).addFlopRaiseNum();
            }
            if(curSeat.bet>myself.playerStatisticTable.get(curSeat.user).getRaiseMax(constant.state.Flop)){
                myself.playerStatisticTable.get(curSeat.user).setRaiseMax(constant.state.Flop, curSeat.bet);
            }
        }
        else if(_.find(myself.allUserInfor, {'user': curSeat.user}).lastValidAction == 4){
            if(curSeat.bet > myself.playerStatisticTable.get(curSeat.user).getFollowMax(constant.state.Flop)){
                myself.playerStatisticTable.get(curSeat.user).setFollowMax(constant.state.Flop, curSeat.bet);
            }
        }
    } else if(state==5){
        if(curSeat.isFold==false){
            curSeat.turnBet = curSeat.bet-curSeat.flopBet-curSeat.preflopBet;
            if(curSeat.turnRaiseBet==-1){
                curSeat.turnRaiseBet = 0;
            }
        }

        myself.playerStatisticTable.get(curSeat.user).setTurnBet(myself.playNum, curSeat.turnBet);
        if(_.find(myself.allUserInfor, {'user': curSeat.user}).lastValidAction == 5){
            //加注的量
            curSeat.turnRaiseBet = curSeat.bet-  curSeat.flopBet-curSeat.preflopBet;
            //统计表加入最新的数据
            myself.playerStatisticTable.get(curSeat.user).setTurnRaiseBet(myself.playNum, curSeat.turnRaiseBet);

            if(myself.playerStatisticTable.get(curSeat.user).isTurnRaiseNumFlag()==false){
                myself.playerStatisticTable.get(curSeat.user).addTurnRaiseNum();
            }
            if(curSeat.getBet()>playerStatisticTable.get(curSeat.user).getRaiseMax(PlayerState.Turn.ordinal())){
                myself.playerStatisticTable.get(curSeat.user).setRaiseMax(PlayerState.Turn.ordinal(), curSeat.bet);
            }
        }
        else if(_.find(myself.allUserInfor, {'user': curSeat.user}).lastValidAction == 4){
            if(curSeat.getBet()>myself.playerStatisticTable.get(curSeat.user).getFollowMax(constant.state.Turn)){
                myself.playerStatisticTable.get(curSeat.user).setFollowMax(constant.state.Turn, curSeat.getBet());
            }
        }
    }
    else if(state==6){
        if(curSeat.isFold==false){
            curSeat.riverBet = curSeat.bet - curSeat.turnBet - curSeat.glopBet - curSeat.preflopBet;
            if(curSeat.riverRaiseBet==-1){
                curSeat.riverRaiseBet = 0;
            }
        }
        myself.playerStatisticTable.get(curSeat.user).setRiverBet(myselfplayNum, curSeat.riverBet);
        if(_.find(myself.allUserInfor, {'user': curSeat.user}).lastValidAction == 5){
            //加注的量
            curSeat.riverRaiseBet(curSeat.bet-curSeat.turnBet-curSeat.flopBet-curSeat.preflopBet);
            //统计表加入最新的数据
            myself.playerStatisticTable.get(curSeat.user).setRiverRaiseBet(myself.playNum, curSeat.riverRaiseBet);

            if(myself.playerStatisticTable.get(curSeat.user).isRiverRaiseNumFlag()==false){
                myself.playerStatisticTable.get(curSeat.user).addRiverRaiseNum();
            }
            if(curSeat.getBet()>myself.playerStatisticTable.get(curSeat.user).getRaiseMax(constant.state.River)){
                myself.playerStatisticTable.get(curSeat.user).setRaiseMax(constant.state.River, curSeat.bet);
            }
        }
        else if(_.find(myself.allUserInfor, {'user': curSeat.user}).lastValidAction == 4){
            if(curSeat.bet>myself.playerStatisticTable.get(curSeat.user).getFollowMax(constant.state.River)){
                myself.playerStatisticTable.get(curSeat.user).setFollowMax(constant.state.River, curSeat.bet);
            }
        }
    }

    if(myself.playerStatisticTable.get(curSeat.user).GetIsWatchedMap(0)==false && curSeat.bet>0.9*myself.playerStatisticTable.get(curSeat.user).getFollowMax(constant.state.River)){
        myself.playerStatisticTable.get(curSeat.user).addWatchGoodNum(0);
        myself.playerStatisticTable.get(curSeat.user).setIsWatchedMap(0, true);
    }
    else if(myself.playerStatisticTable.get(curSeat.user).GetIsWatchedMap(1)==false && curSeat.bet>0.5*myself.playerStatisticTable.get(curSeat.user).getFollowMax(constant.state.River)){
        myself.playerStatisticTable.get(curSeat.user).addWatchGoodNum(1);
        myself.playerStatisticTable.get(curSeat.user).setIsWatchedMap(1, true);
    }
    else if(myself.playerStatisticTable.get(curSeat.user).GetIsWatchedMap(2)==false && curSeat.bet>0.25*myself.playerStatisticTable.get(curSeat.user).getFollowMax(constant.state.River)){
        myself.playerStatisticTable.get(curSeat.user).addWatchGoodNum(2);
        myself.playerStatisticTable.get(curSeat.user).setIsWatchedMap(2, true);
    }
}

function isJettonDominated(myJetton, totalJetton, playerNum, smallBlindBet, bigBlindBet, curPlayNum, maxPlayNum){
    if(playerNum<2 || curPlayNum>maxPlayNum){
        return true;
    }
    else if(playerNum==2){
        let leftPlayNum=maxPlayNum-curPlayNum+1;
        if(myJetton-smallBlindBet*((leftPlayNum/2)+1)>totalJetton/2){
            return true;
        }
    }
    else{
        let leftPlayNum=maxPlayNum-curPlayNum+1;
        if(myJetton-(smallBlindBet+bigBlindBet)*((leftPlayNum/3)+1)>totalJetton/2){
            return true;
        }
    }
    return false;
}

function isJettonEnough(myJetton, jetton_2nd, jetton_3rd, playerNum, smallBlindBet, bigBlindBet, curPlayNum, maxPlayNum){
    if(playerNum<3 || curPlayNum>maxPlayNum){
        return false;
    }
    //如果自己的筹码远远领先于第二第三名的和
    else{
        let leftPlayNum=maxPlayNum-curPlayNum+1;
        if(myJetton>jetton_2nd+jetton_3rd+2*(smallBlindBet+bigBlindBet)*((leftPlayNum/3)+1)){
            return true;
        }
    }
    return false;
}