---
layout:     post                    # 使用的布局（不需要改）
title:      Cocos creator前端人士学习笔记（一）               # 标题 
subtitle:   前端开发者如何进行进行Cocos开发 #副标题
date:       2022-10-31              # 时间
author:     Warden_Gfs                      # 作者
header-img: img/head-bg-view-19.png    #这篇文章标题背景图片
catalog: true                       # 是否归档
highlight:
  theme: monokai    # 设置深色主题，如 monokai、dracula 等
  enable: true
tags:                               #标签
    - 技术研讨
    - Cocos creator
    - 游戏开发
---

> 世界上最顶级的学习方法之一，费曼学习法，通过向别人解说某一件事，来确定自己是否真正弄懂这件事。
由于业务相关原因，最近需要学习cocos creator来制作一些H5小游戏。说一说这几天学习cocos creator过程中，我最初关心的几个疑问和我给出的答案，可能也是其他初学游戏的同学的困惑。

**1、作为前端开发的我所掌握的技术能否做出一个游戏来？**
答案是能。
掌握Typescript即可，cocos creator主要使用ts进行开发。但是你需要学习更多的游戏开发概念。

**2、游戏和网页开发有什么不同？**
我认为在写网页的时候（比如react）我们更注重数据是如何流动的，组件只是一个组装UI的代码模块，输入数据，展现一个UI界面，我们基本上不需要去操作、创建或销毁Component。我们只是把一个又一个的组件元素拼成一个页面，然后通过类如props来通信。

但是游戏则更注重逻辑，偏面向对象开发，比如预制，他只有在其他组件里面获取到这个预制并且实例化之后完成某个任务才有意义，前端开发时，我们UI是直接在组件内写的，编译之后输出虚拟的DOM结构完成页面渲染。而游戏则需要我们手动去创建节点，在代码里把实例化完的预制节点挂在到另一个节点，游戏引擎解析检索节点树来完成游戏界面的渲染。

web开发的资源加载主要是通过网络来加载，而游戏通过静态检索和动态加载来管理获取资源。静态检索指的把资源挂在到某个节点的属性上，指向资源的ID；动态加载指的根据资源路径动态加载，当引擎进行打包的时候，会把resources目录下的所有资源以及其他目录里面的静态资源一并打包。注意：这个resources文件夹需要手动创建在assets根目录下。

```ts
// 加载 Prefab
    resources.load("test_assets/prefab", Prefab, (err, prefab) => {
      const newNode = instantiate(prefab);
      this.node.addChild(newNode);
    });
```

**3、如何做好游戏适配**
游戏中的弹性适配是自带的。我们可以使用cocos creator提供的一些组件来完成适配和UI界面的完成。比如`**Widget**`、`**Sliced Sprite**`、`**Label**`等组件。
在游戏工程中需要设置顶层节点（Canvas）的设计分辨率，并指定是按照高度还是宽度适配，这里先假定按照高度适配。设定完成后，最终 canvas 的高度就会撑满屏幕，然后宽度按比例缩放。当然这种适配方式只能根据屏幕做等比缩放，还是很有局限性的。

![如何做好游戏适配](/img/20221031/img1.png)

如果我此时想实现类似于flex的布局该如何处理？比如多个子元素在固定大小父元素下的弹性布局。我们可以试着使用Layout 组件，如果在进行更为精细的屏幕适配和弹性布局，可能需要手动对节点进行缩放。

![如何做好游戏适配](/img/20221031/img2.png)


**4、在初步制作飞机大战游戏后，我认为Cocos必须知道的一部分重要知识点。**
**①  相机**
相机就像上帝视角，分为分为 **透视投影（PERSPECTIVE）** 和 **正交投影（ORTHO）**两种模式，并且其有非常多的参数可供调整，直接影响我们引擎渲染出来的游戏画面能看到什么。拉进相机，会发现我们的画面越来越大，就像真实世界那样，具体可以自己尝试调整。

**② 节点**
节点是承载组件的实体，我们在节点上挂载各种各样千奇百怪的组件，由此组成游戏的五脏六腑。

**③ 预制体（Prefab）**
游戏开发常见字眼，可以理解为一种可重用资源，一种提前准备好的资源。
比如，飞机大战中持续出现的敌机、不断被发射出来的子弹。亦或魔兽世界中各种各样的NPC，怪物等，都是预制体。即我在实际代码操作中可以直接拿过来用，不断重复使用的东西。new一个xxx。
我们设想，就类似于我们前端里面的组件，比如弹框组件，按道理也可以做成一个预制，这样方便调用。
::预制体制作：::
非常简单，直接把制作好的节点从层级管理器拖到资源管理器，里面可能包含了材质贴图挂载的脚本等。

![预制体](/img/20221031/img3.png)

::预制体修改：::
双击预制体，修改完毕点保存，

![预制体](/img/20221031/img4.png)

如果在节点中修改了预置，需要点击更新到资源

![预制体](/img/20221031/img5.png)

::预制体使用三步走：::
	* instantiate() ：实例化一个预制体，让其变成一个节点
	* setParent() / addChild()：设置被实例化出来的节点的父/子节点，我理解就是挂载节点
	* getComponent()：获取节点上指定类型的组件，如果节点有附加指定类型的组件，则返回，如果没有则为空。 获取到之后就可以使用了。
所以预制体是要先实例化，再挂载，再调用

**④ @property**
属性装饰器，极为常用，在TS脚本中如果定义了这个，则就可以在creator的属性检查器面板中找到。如果是整数/浮点数/字符串/布尔值的情况，则不需要显式声明类型，如果是预制体、Node节点等，则需要声明。使用属性装饰器有个好处，就是你可以直接在调试游戏相关参数的时候快速修改一些常用的值，比如敌机飞行速度、子弹发生间隔等。如果是私有变量，则最好约定为private加下划线开头来声明。


![@property](/img/20221031/img6.png)
![@property](/img/20221031/img7.png)

**⑤ 碰撞体、刚体**
这两个都属于物理组件，在做游戏的时候，比如超级玛丽，玛丽可以跳起来停在水管上。跳、下落、站等这些都是物理学会遇到的概念，他们都是有物理属性的，比如摩擦力、质量、引力等。
**碰撞体：**碰撞体是产生碰撞的前提，比如`boxCollider`组件
**刚体：**（rigidBody）如果需要物理学的属性，比如自由落体等，则需要添加刚体，在物体间发生碰撞时，主动体身上必须添加刚体。刚体包括静态刚体(static)、运动学刚体(kinematic)、动力学刚体(dynamic) [详情见传送门](https://docs.cocos.com/creator/manual/zh/physics/physics-rigidbody.html)

***简单总结一下：***
刚体是物理抽象模型，里面是力学数据属性。碰撞体是需要描绘物体的碰撞形状，比如圆形，立方体，模型形状。
IsTrigger：
决定了组件为触发器还是碰撞器。如果设置为 true ，组件为触发器。触发器只用于碰撞检测和触发事件，会被物理引擎忽略。默认设置 false，组件为碰撞器，可以结合 刚体产生碰撞效果。
触发事件：`onTriggerEnter、onTriggerStay、onTriggerExit`
碰撞事件：`onCollisionEnter、onCollisionStay、onCollisionExit`

碰撞矩阵：
先定义哪些刚体可以产生碰撞，在实际碰撞/触发监听回调内判断不同碰撞进行不同操作。比如在下方我定义了一些敌机、敌机子弹、玩家飞机、玩家子弹等类型。


![碰撞矩阵](/img/20221031/img8.png)

```ts
onEnable() {
        const collider = this.getComponent(BoxCollider);
        collider.on('onTriggerEnter', this._onTriggerEnter, this)
    }
    onDisable() {
        const collider = this.getComponent(BoxCollider);
        collider.off('onTriggerEnter', this._onTriggerEnter, this)
    }
    // 设置触发事件
    private _onTriggerEnter(event: ITriggerEvent) {
        const collisionGroup = event.otherCollider.getGroup()
        // 判断当前碰撞是否为敌方飞机和玩家子弹，如果敌方飞机被玩家子弹所射击，则销毁敌方飞机
        if (collisionGroup === Constant.CollisionType.SELF_PLANE || Constant.CollisionType.SELF_BULLET) {
            this.node.destroy()
            // 加分
            this._gameManager.addScore()
        }
    }
```
	

