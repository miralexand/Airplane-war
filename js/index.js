/**
 * Created by max on 2017/7/24.
 */
var strat_a = document.getElementById("strat_a");
var strat_main = document.getElementById("strat_main");
var containt_main = document.getElementById("containt_main");
var mainBox = document.getElementById("mainBox");
var myPlan = document.getElementById("myPlan");
var btnXu = document.getElementById("btnXu");
var btnJixu = document.getElementById("btnJixu");
var btnRe = document.getElementById("btnRe");
var btnMain = document.getElementById("btnMain");
var fenshu = 0;
//分数
var fen = document.getElementById("fen");
var fenBox = document.getElementById("fenBox");
var fenBox_p = document.getElementById("fenBox_p");
var windowW = document.body.offsetWidth;
var windowH = document.body.offsetHeight;

myPlan.timeId = null;
strat_a.onclick = function(){
    strat_main.style.display = "none";
    containt_main.style.display = "block";
    myPlan.timeId = setInterval(strat,20);
}
function yidong(e){
    var e = e || window.event;
    var pageX = e.changedTouches[0].pageX;
    var pageY = e.changedTouches[0].pageY;
    var containtTop = document.querySelector(".main").offsetTop;
    var containtLeft = document.querySelector(".main").offsetLeft;
    //console.log(x+",,,"+y);
    //myPlan.style.transform = "translate("+(offx-myPlanX-33)+"px,"+(offy-myPlanY-40)+"px)"
    var x = pageX - containtLeft;
    var y = pageY - containtTop;
    //console.log(x + ">>>" + y);
    x = x <= 5 ? 5:x;
    y = y <= 40 ? 40:y;
    x = x >= windowW-5 ? windowW-5:x;
    y = y >= windowH-myPlan.offsetHeight/2 ? windowH-myPlan.offsetHeight/2:y;
    myPlan.style.left = (x)+"px";
    myPlan.style.top = (y)+"px";
}
myPlan.addEventListener("touchmove",yidong)
//setInterval(function(){
//    var danY = myPlan.offsetTop;
//    var danX = myPlan.offsetLeft+myPlan.offsetWidth/2;
//    console.log(danX);
//    console.log(danY);
//    var danImg = document.createElement("img");
//    danImg.src = "images/bullet1.png";
//    danImg.style.position = "absolute";
//    danImg.style.top = danY + "px";
//    danImg.style.left = danX + "px";
//    containt_main.append(danImg);
//},20)
//子弹
function Zidan(x,y,danAttack,img){
    this.danX = x;
    this.danY = y;
    this.danAttack = danAttack;
    this.srcImg = img;
    this.danImg = null;
    this.move = function(){
        this.danImg.style.top = this.danImg.offsetTop - 20 +"px";
    },
    this.into = function(){
        this.danImg = document.createElement("img");
        this.danImg.src = this.srcImg;
        this.danImg.style.position = "absolute";
        this.danImg.style.top = this.danY + "px";
        this.danImg.style.left = this.danX + "px";
        containt_main.appendChild(this.danImg);
    }
    this.into();
}
//敌机
function DiPlan(x,width,heigth,sudu,bloodVal,diItems,num,boomImg,srcImg){
    this.diplanImg = null;
    this.diplanX = x;
    this.diplanSrc = srcImg;
    this.diplanWidth = width;
    this.diItems = diItems;
    this.diItem = 0;
    this.bloodVal = bloodVal;
    this.boomImg = boomImg;
    this.fenshu = num;
    this.sudu = sudu;
    this.diplanDie = false;
    this.dimove = function(){
        //计算敌机速度
        if(fenshu <= 5000){
            this.diplanImg.style.top = this.diplanImg.offsetTop + this.sudu + "px";
        }else if(fenshu <=20000){
            this.diplanImg.style.top = this.diplanImg.offsetTop + this.sudu +1+ "px";
        }else if(fenshu <= 40000){
            this.diplanImg.style.top = this. diplanImg.offsetTop + this.sudu +2+ "px";
        }else{
            this.diplanImg.style.top = this.diplanImg.offsetTop + this.sudu +3+ "px";
        }
    },
    this.into = function(){
        this.diplanImg = document.createElement("img");
        this.diplanImg.src = this.diplanSrc;
        this.diplanImg.style.position = "absolute";
        this.diplanImg.style.top = -heigth +"px";
        this.diplanX = this.diplanX+this.diplanWidth > containt_main.offsetWidth ? containt_main.offsetWidth - this.diplanWidth:this.diplanX;
        //console.log(this.diplanImg.offsetWidth);
        //console.log(this.diplanX);
        this.diplanImg.style.left = this.diplanX + "px";
        containt_main.appendChild(this.diplanImg)
    }
    this.into();
}
function random(min,max){
    return min+Math.random()*(max-min);
}
//敌机对象数组
var diplanArr = [];
//子弹对象数组
var zidanArr = [];
var mark = 0;
function strat(){
    //console.log(myPlan.offsetLeft + myPlan.offsetWidth / 2 - 3);
    mark++;
    //敌机
    if(fenshu <=5000){
        if(mark%20 == 0){
            var diplan_smail = new DiPlan(Math.random()*containt_main.offsetWidth,34,24,random(1,4),1,340,100,"images/enemy1_boom.gif","images/enemy1_fly_1.png");
            diplanArr.push(diplan_smail);
            //console.log(Math.random() * containt_main.offsetWidth);
        }
        if(mark%100 == 0){
            var diplan_zhong = new DiPlan(Math.random()*containt_main.offsetWidth,46,60,random(1,3),4,340,400,"images/enemy3_boom.gif","images/enemy3_fly_1.png");
            diplanArr.push(diplan_zhong);
        }
    }else if(fenshu <=10000){
        if(mark%15 == 0){
            var diplan_smail = new DiPlan(Math.random()*containt_main.offsetWidth,34,24,random(1,4),1,340,100,"images/enemy1_boom.gif","images/enemy1_fly_1.png");
            diplanArr.push(diplan_smail);
            //console.log(Math.random() * containt_main.offsetWidth);
        }
        if(mark%50 == 0){
            var diplan_zhong = new DiPlan(Math.random()*containt_main.offsetWidth,46,60,random(1,3),4,340,400,"images/enemy3_boom.gif","images/enemy3_fly_1.png");
            diplanArr.push(diplan_zhong);
        }
    }else{
        if(mark%10 == 0){
            var diplan_smail = new DiPlan(Math.random()*containt_main.offsetWidth,34,24,random(1,4),1,340,100,"images/enemy1_boom.gif","images/enemy1_fly_1.png");
            diplanArr.push(diplan_smail);
            //console.log(Math.random() * containt_main.offsetWidth);
        }
        if(mark%50 == 0){
            var diplan_zhong = new DiPlan(Math.random()*containt_main.offsetWidth,46,60,random(1,3),4,340,400,"images/enemy3_boom.gif","images/enemy3_fly_1.png");
            diplanArr.push(diplan_zhong);
        }
    }

    if(mark%400 == 0){
        var diplan_big = new DiPlan(Math.random()*containt_main.offsetWidth,110,164,1,10,560,1000,"images/enemy2_boom.gif","images/enemy2_fly_1.png");
        diplanArr.push(diplan_big);
        mark = 0;
    }

    for(var j = 0; j < diplanArr.length; j++){
        //敌机移动
        if(diplanArr[j].diplanDie == false){
            diplanArr[j].dimove();
        }
    //    超出边界删除敌机
        if(diplanArr[j].diplanImg.offsetTop > windowH){
            containt_main.removeChild(diplanArr[j].diplanImg);
            diplanArr.splice(j,1);
        }
        //敌机死亡
        if(diplanArr[j].diplanDie == true){
            diplanArr[j].diItem += 20;
            if(diplanArr[j].diItems == diplanArr[j].diItem){
                containt_main.removeChild(diplanArr[j].diplanImg);
                diplanArr.splice(j,1);
            }
        }
    }
    //子弹
    if(mark%5 == 0){
        var zidan = new Zidan(myPlan.offsetLeft+myPlan.offsetWidth/2-3,myPlan.offsetTop-14,1,"images/bullet1.png");
        zidanArr.push(zidan);
    }
    for(var i = 0; i < zidanArr.length; i++){
        zidanArr[i].move();
        //超出边界删除子弹
        if(zidanArr[i].danImg.offsetTop < 0){
            containt_main.removeChild(zidanArr[i].danImg);
            zidanArr.splice(i,1);
            //zidanArr.length--;
        }
    }
    for(var z =0; z <zidanArr.length; z++){
        for(var k = 0; k < diplanArr.length; k++){
            if(diplanArr[k].diplanDie == false){
                //本机碰撞爆炸
                if(!(myPlan.offsetTop+myPlan.offsetHeight-10<diplanArr[k].diplanImg.offsetTop || myPlan.offsetLeft+myPlan.offsetWidth-10<diplanArr[k].diplanImg.offsetLeft || myPlan.offsetTop+10>diplanArr[k].diplanImg.offsetTop+diplanArr[k].diplanImg.offsetHeight || myPlan.offsetLeft+10>diplanArr[k].diplanImg.offsetLeft+diplanArr[k].diplanImg.offsetWidth)){
                    var fenHtml = fen.innerHTML;
                    //console.log(fenHtml);
                    myPlan.src = "images/myPlan_boom.gif";
                    fenBox_p.innerText = fenHtml;
                    fenBox.style.display = "block";
                    myPlan.removeEventListener("touchmove",yidong);
                    containt_main.style.animationPlayState = "paused";
                    clearInterval(myPlan.timeId);
                }
                //子弹碰撞
                //if(zidanArr[z].danImg.offsetTop<=diplanArr[k].diplanImg.offsetTop+diplanArr[k].diplanImg.offsetHeight){
                //    if(zidanArr[z].danImg.offsetLeft<=diplanArr[k].diplanImg.offsetLeft+diplanArr[k].diplanImg.offsetWidth && zidanArr[z].danImg.offsetLeft+zidanArr[z].danImg.offsetWidth>=diplanArr[k].diplanImg.offsetLeft){
                //console.log(zidanArr[z].danImg);
                if(!(zidanArr[z].danImg.offsetTop+zidanArr[z].danImg.offsetHeight<diplanArr[k].diplanImg.offsetTop || zidanArr[z].danImg.offsetLeft+zidanArr[z].danImg.offsetWidth<diplanArr[k].diplanImg.offsetLeft || zidanArr[z].danImg.offsetTop>diplanArr[k].diplanImg.offsetTop+diplanArr[k].diplanImg.offsetHeight || zidanArr[z].danImg.offsetLeft>diplanArr[k].diplanImg.offsetLeft+diplanArr[k].diplanImg.offsetWidth)){
                        diplanArr[k].bloodVal = diplanArr[k].bloodVal - zidanArr[z].danAttack;
                        ////当敌机血量等于0时
                        if(diplanArr[k].bloodVal == 0){
                            diplanArr[k].diplanDie = true;
                            diplanArr[k].diplanImg.src = diplanArr[k].boomImg;
                            //增加分数
                            fenshu += diplanArr[k].fenshu;
                            fen.innerHTML = fenshu;
                        }
                        ////删除子弹
                        containt_main.removeChild(zidanArr[z].danImg);
                        zidanArr.splice(z,1);
                        break;
                }
            }

        }
    }

}
btnXu.onclick = zhongxin;
btnRe.onclick = zhongxin;

myPlan.onclick = function(){
    clearInterval(myPlan.timeId);
    myPlan.removeEventListener("touchmove",yidong);
    containt_main.style.animationPlayState = "paused";
    mainBox.style.display = "block";
}
btnJixu.onclick = function(){
    myPlan.timeId = setInterval(strat,20);
    myPlan.addEventListener("touchmove",yidong);
    containt_main.style.animationPlayState = "running";
    mainBox.style.display = "none";
}
btnMain.onclick = function(){
    location.reload(true);
}

function zhongxin(){
    fenshu = 0;
    fen.innerHTML = "0";
    myPlan.style.top = "";
    myPlan.style.bottom =0+"px";
    myPlan.style.left = "50%";
    myPlan.src = "images/myPlan.gif";
    fenBox.style.display = "none";
    mainBox.style.display = "none";
    containt_main.style.animationPlayState = "running";
    mark = 0;
    diplanArr = [];
    zidanArr = [];
    var conChn = containt_main.children
    var conChnLen = conChn.length;
    for(var i = 0; i < conChnLen; i++){
        if(!(i<=3)){
            containt_main.removeChild(conChn[i]);
            console.log(conChn);
            conChnLen--;
            i--;
        }
    }
    myPlan.addEventListener("touchmove",yidong);
    myPlan.timeId = setInterval(strat,20);
}