﻿var vdata = new Vue({
    data: {
        //数据实体
        course: {},      //当前课程
        outline: {},     //当前课程章节
        subject: {},     //当前专业
        outlines: [],     //当前课程的章节列表（树形）
        access: [],          //附件列表
        events: [],          //视频事件
        //当前章节的视频信息
        video: {
            url: '',         //视频路径
            total: 0,        //总时长      
            playTime: 0,         //当前播放时间，单位：毫秒     
            playhistime: 0,    //历史播放时间
            studytime: 0,    //累计学习时间
            percent: 0       //完成度（百分比）
        },
        playtime: 0,         //当前播放时间，单位：秒
        //状态
        state: {},           //课程状态       
        couid: $api.querystring("couid"),
        olid: $api.querystring("olid"),
        median: false,     //分隔线折叠状态
        titState: 'loading',        //左侧选项卡的状态
        rightState: 'outline',       //右侧选项卡状态，章节outline,交流chat
        outlineLoaded: false,         //右侧章节列表加载中
        studylogUpdate: false,           //学习记录是否在递交中
        studylogState: 0,            //学习记录提交状态，1为成功，-1为失败
        //控件
        player: null             //播放器
    },
    watch: {
        //课程状态
        state: function (val) {
            if (vdata.state.isNull) vdata.titState = 'isNull';
            if (vdata.state.isAccess) vdata.titState = 'isAccess';
            if (vdata.state.isQues) vdata.titState = 'isQues';
            if (vdata.state.isContext) vdata.titState = 'isContext';
            if (vdata.state.isLive) vdata.titState = 'isLive';
            if (vdata.state.existVideo) vdata.titState = 'existVideo';
            //视频播放
            vdata.videoPlay(vdata.state);
        },
        //左侧选项卡切换
        titState: function (val) {
            if (vdata.playready()) {
                vdata.titState == 'existVideo' ? vdata.player.play() : vdata.player.pause();
            }
        },
        'video': {
            handler: function (val, old) {

            },
            deep: true
            //immediate: true
        },
        //播放进度变化
        playtime: function (val) {
            vdata.video.studytime++;
            //学习记录提交
            vdata.videoLog();
            //触发视频事件
            vdata.videoEvent(vdata.playtime);
        }
    },
    methods: {
        //知识库的点击事件
        knlClick: function () {
            new top.PageBox('课程知识库', 'Knowledges.ashx?couid=' + vdata.couid, 100, 100, null, window.name).Open();
        },
        //附件的点击事件
        accessClick: function (file, tit, event) {
            var exist = file.substring(file.lastIndexOf(".") + 1).toLowerCase();
            if (exist == "pdf") {
                event.preventDefault();
                var box = new PageBox(tit, $().PdfViewer(file), 100, 100, null, window.name);
                box.Open();
            }
            return false;
        },
        //章节列表的点击事件
        outlineClick: function (olid, event) {
            var url = $api.setpara("olid", olid);
            history.pushState({}, null, url);
            vdata.olid = olid;
            vdata.titState = 'loading';
            if (event != null) event.preventDefault();
            //获取当前章节状态，和专业信息
            $api.all(
                $api.get("Outline/ForID", { id: olid }),
                $api.get("Outline/state", { olid: olid })
            ).then(axios.spread(function (ol, state) {
                if (ol.data.success && state.data.success) {
                    vdata.outline = ol.data.result;
                    vdata.state = state.data.result;
                    //视频播放记录
                    var result = state.data.result;
                    vdata.video.studytime = isNaN(result.StudyTime) ? 0 : result.StudyTime;
                    vdata.video.playhistime = isNaN(result.PlayTime) ? 0 : result.PlayTime / 1000;
                    window.setTimeout(function () {
                        vdata.outlineLoaded = true;
                    }, 100);
                    //获取附件
                    if (state.data.result.isAccess) {
                        $api.get("Outline/Accessory", { uid: vdata.outline.Ol_UID }).then(function (acc) {
                            if (acc.data.success) {
                                vdata.access = acc.data.result;
                            } else {
                                alert("附件信息加载错误");
                            }
                        });
                    }
                    //获取视频事件
                    if (state.data.result.existVideo) {
                        $api.get("Outline/VideoEvents", { olid: vdata.outline.Ol_ID }).then(function (req) {
                            if (req.data.success) {
                                vdata.events = req.data.result;
                            } else {
                                alert("视频事件加载失败");
                            }
                        });
                    }
                } else {
                    if (!ol.data.success) alert("章节信息加载错误");
                    if (!state.data.success) alert("章节状态加载错误");
                }
            }));
        },
        //播放器是否准备好
        playready: function () {
            if (vdata.player != null) {
                return vdata.player._isReady && vdata.player.engine;
            }
            return false;
        },
        //视频播放
        videoPlay: function (state) {
            if (vdata.playready()) {
                vdata.player.destroy();
                vdata.player = null;
            }
            if (!vdata.state.isLive) {  //点播
                vdata.player = new QPlayer({
                    url: state.urlVideo,
                    container: document.getElementById("videoplayer"),
                    autoplay: true,
                });
            } else {
                //直播
                vdata.player = new QPlayer({
                    url: state.urlVideo,
                    container: document.getElementById("livebox"),
                    isLive: true,
                    autoplay: true
                });
            }
            if (vdata.player != null) {
                vdata.player.on("loading", vdata.videoready);
                vdata.player.on("ready", vdata.videoready);
                vdata.player.on("timeupdate", function (currentTime, totalTime) {
                    vdata.video.total = parseInt(totalTime);
                    vdata.video.playTime = currentTime;   //详细时间，精确到毫秒
                    vdata.playtime = parseInt(currentTime);
                    //学习完成度，最大为百分百
                    vdata.video.percent = Math.floor(vdata.video.studytime <= 0 ? 0 : vdata.video.studytime / vdata.video.total * 1000) / 10;
                    vdata.video.percent = vdata.video.percent > 100 ? 100 : vdata.video.percent;
                });
                vdata.player.on("seeked", function () {
                    var playtime = vdata.playready() ? vdata.player.currentTime : vdata.playtime;
                    //alert(playtime);
                    vdata.playtime = playtime;
                    window.setTimeout(function () {
                        if (vdata.playready()) vdata.player.pause();
                    }, 50);

                });
            }

        },
        //播放器加载后的事件
        videoready: function () {
            //隐藏全屏按钮
            var fullbtn = document.getElementsByClassName("qplayer-fullscreen");
            for (var i = 0; i < fullbtn.length; i++) {
                fullbtn[i].style.display = "none";
            }
            //隐藏设置按钮(播放倍速也禁用了)
            var setbtn = document.getElementsByClassName("qplayer-settings-btn");
            for (var i = 0; i < setbtn.length; i++) {
                setbtn[i].style.display = "none";
            }
        },
        //视频播放跳转
        videoSeek: function (second) {
            if (vdata.playready()) vdata.player.seek(second);
        },
        //学习记录记录
        videoLog: function () {
            if (vdata.studylogUpdate) return;
            var interval = 1; 	//间隔百分比多少递交一次记录
            if (vdata.video.total <= 5 * 60) interval = 10; //5分钟内
            else if (vdata.video.total <= 10 * 60) interval = 5;
            var per = Math.floor(vdata.video.studytime <= 0 ? 0 : vdata.video.studytime / vdata.video.total * 1000) / 10;
            if (per > 0 && per < (100 + interval) && per % interval == 0) {
                $api.post("Course/StudyLog", {
                    couid: vdata.course.Cou_ID, olid: vdata.outline.Ol_ID,
                    playTime: vdata.playtime, studyTime: vdata.video.studytime, totalTime: vdata.video.total
                }, function () {
                    vdata.studylogUpdate = true;
                }, function () {
                    vdata.studylogUpdate = false;
                }).then(function (req) {
                    vdata.studylogState = 1;
                    window.setTimeout(function () {
                        vdata.studylogState = 0;
                    }, 2000);
                }).catch(function (err) {
                    vdata.studylogState = -1;
                    window.setTimeout(function () {
                        vdata.studylogState = 0;
                    }, 2000);
                });
            }
        },
        //视频事件的触发
        videoEvent: function (playtime) {
            if (vdata.events.length < 1) return;
            var curr = null;
            for (var ev in vdata.events) {
                if (vdata.events[ev].Oe_TriggerPoint == playtime) {
                    curr = vdata.events[ev];
                    break;
                }
            }
            if (curr == null) return;
            //视频暂停
            if (vdata.playready()) vdata.player.pause();
            var box = new MsgBox();
            box.OverEvent = function () {
                if (vdata.playready()) vdata.player.play();
            }
            if (curr.Oe_EventType == 1)
                box.Init("提示：" + curr.Oe_Title, curr.Oe_Context, curr.Oe_Width, curr.Oe_Height, "alert").Open();
            if (curr.Oe_EventType == 2)
                box.Init("知识点：" + curr.Oe_Title, curr.Oe_Context, curr.Oe_Width, curr.Oe_Height, "alert").Open();
            if (curr.Oe_EventType == 3) {
                var items = eval(curr.Oe_Datatable);
                var context = curr.Oe_Context + "<div class='quesBox'>";
                for (var i in items) {
                    if (items[i].item == "") continue;
                    context += "<div onclick='vdata.videoEventClick(" + items[i].iscorrect + ",-1)'>" +
                        (Number(i) + 1) + "、" + items[i].item + "</div>";
                }
                context += "</div>";
                box.Init("提问" + curr.Oe_Title, context, curr.Oe_Width, curr.Oe_Height, "null").Open();
            }
            if (curr.Oe_EventType == 4) {
                var items = eval(curr.Oe_Datatable);
                var context = curr.Oe_Context + "<div class='quesBox'>";
                for (var i in items) {
                    if (items[i].item == "") continue;
                    context += "<div onclick='vdata.videoEventClick(null," + items[i].point + ")'>" +
                        (Number(i) + 1) + "、" + items[i].item + " - （跳转到：" + items[i].point + "秒）</div>";
                }
                context += "</div>";
                box.Init("实时反馈：" + curr.Oe_Title, context, curr.Oe_Width, curr.Oe_Height, "alert").Open();
            }
        },
        //视频事件的点击操作
        videoEventClick: function (iscorrect, seek) {
            //视频事件的问题
            if (iscorrect != null && iscorrect) {
                MsgBox.Close();
            }
            //视频跳转
            if (iscorrect == null && seek > 0) {
                if (!vdata.playready()) return;
                vdata.player.seek(seek);
                MsgBox.Close();
            }
        }
    },
    created: function () {
        var couid = $api.querystring("couid");
        $api.all(
            $api.get("Outline/tree", { couid: couid }),
            $api.get("Course/ForID", { id: couid })).then(axios.spread(function (ol, cur) {
                if (ol.data.success && cur.data.success) {
                    vdata.outlines = ol.data.result;
                    if (vdata.olid == '') vdata.olid = ol.data.result[0].Ol_ID;
                    vdata.outlineClick(vdata.olid, null);
                    vdata.course = cur.data.result;
                    $api.get("Subject/ForID", { id: vdata.course.Sbj_ID }).then(function (subject) {
                        if (subject.data.success) {
                            vdata.subject = subject.data.result;
                        } else {
                            if (!subject.data.success) alert("课程所属专业加载错误");
                        }
                    });
                } else {
                    if (!ol.data.success) alert("章节列表加载错误");
                    if (!cur.data.success) alert("课程信息加载错误");
                }
            }));
    },
    mounted: function () {
        //alert(3);
    },

});
vdata.$mount('#body');
/*
window.onblur = function () {
    if (vdata.playready()) {
        vdata.player.pause();
    }
}
window.onfocus = function () {
    if (vdata.playready()) {
        vdata.titState == 'existVideo' ? vdata.player.play() : vdata.player.pause();
    }
}
*/
/*===========================================================================================

视频的播放事件

*/
/*
MsgBox.OverEvent = function () {
    CKobject.getObjectById('ckplayer_videobox').videoPlay();
};
//通过播放时间，激活视频事件
function activeEvent(time) {
    //实际播放的时间值，单位秒
    var s = Math.floor(Number(time));
    //
    $("#events .eventItem").each(function () {
        var point = Number($(this).attr("point"));
        if (point == s) {
            //暂停播放
            CKobject.getObjectById('ckplayer_videobox').videoPause();
            //激出弹出窗口
            var tit = $(this).find(".eventTitle").html();
            var width = Number($(this).attr("winWidth"));
            var height = Number($(this).attr("winHeight"));
            var contx = $(this).find(".eventContext").html();
            var type = Number($(this).attr("type"));
            //如果是提醒或知识展示
            if (type == 1 || type == 2) {
                new MsgBox(tit, contx, width, height, "alert").Open();
            }
            //如果是试题
            if (type == 3) {
                new MsgBox(tit, $(this).html(), width, height, "null").Open();
                $(".MsgBoxContext .eventTitle").remove();
                $(".MsgBoxContext .quesBox .ansItem").click(function () {
                    if ($(this).attr("iscorrect") == "True") {
                        var quesAnd = $(".MsgBoxContext .quesAns");
                        quesAnd.hide();
                        quesAnd.html("&radic; 回答正确！");
                        quesAnd.css("color", "green");
                        quesAnd.show(100);
                        setTimeout("MsgBox.Close()", 1000);
                    } else {
                        var quesAnd = $(".MsgBoxContext .quesAns");
                        quesAnd.hide();
                        quesAnd.html("&times; 回答错误！");
                        quesAnd.css("color", "red");
                        quesAnd.show(100);
                    }
                });
            }
            //如果是实时反馈
            if (type == 4) {
                new MsgBox(tit, $(this).html(), width, height, "null").Open();
                $(".MsgBoxContext .eventTitle").remove();
                $(".MsgBoxContext .quesBox .ansItem").click(function () {
                    var playPoint = Number($(this).attr("point"));
                    CKobject.getObjectById('ckplayer_videobox').videoSeek(playPoint);
                    MsgBox.Close(true);
                });
            }
        }
    });
}*/