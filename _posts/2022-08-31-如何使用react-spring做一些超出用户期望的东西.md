---
layout:     post                    # 使用的布局（不需要改）
title:      如何使用react-spring做一些超出用户期望的东西               # 标题 
subtitle:   什么样的动画让人看起来比较舒服？什么动画是给人以高级感？#副标题
date:       2022-08-31              # 时间
author:     Warden_Gfs                      # 作者
header-img: img/head-bg-view-21.png    #这篇文章标题背景图片
highlight:
  theme: monokai    # 设置深色主题，如 monokai、dracula 等
  enable: true
catalog: true                       # 是否归档
tags:                               #标签
    - 技术研讨
    - React-spring
    - 动效
---

> 动画在前端开发中是提升用户体验的重要工具。一个优秀的动画设计不仅能够让界面更具吸引力，还能帮助用户更直观地理解界面交互逻辑。然而，在实际开发中，我们往往会受限于 CSS 定义的时间曲线和固定的时长，导致动画效果显得生硬、不够自然。

在最近的一个复杂交互项目中，我们深入研究了 React-spring —— 一个基于物理模型的动画库。它通过模拟现实世界的物理规律（如质量、张力和摩擦力）来创建自然流畅的动画效果。本文将分享我们在使用 React-spring 完成高质量动画设计中的实践经验，并介绍其核心 API 和最佳实践，帮助你在项目中更高效地实现精致的动画效果。

接下来，我们将从动画的基础原理入手，逐步探讨如何利用 React-spring 的强大能力打造超出用户预期的交互体验。



## 题记
动画是用户体验上非常重要的一环，动画可以有很多种，大到过渡动效，切换渐变，小至一些icon的俏皮旋转跳跃，这些都参与了整个用户的交互过程。那么如何做到超出预期的体验？我认为在细节的处理上十分重要，如果做的好的话，则会有明显的质量提升。最近我们在做一款类似于页游的产品，我正在探索寻得一个较好的React动画解决方案。

## 思考
首先我们思考，什么样的动画让人看起来比较舒服？什么动画是给人以高级感？是那些平滑的CSS渐变？还是人为定义的一些曲线函数，亦或是设定一个你认为合理的动画持续时间。我认为，大道至简，自然界创造的才是最迷人的。苹果从树上落到地面，这个动画需要考虑哪些东西？我想你可能需要注意比你认为的还要更多。

## 为什么是react-spring
至此，我决定引入react-spring。先说一说它的优点，非常容易在react中操作动画、非常符合react声明式的特点、灵活可配、高性能、自然细腻流畅、效果真实。在接触并使用它一段时间之后，我思考我们是否需要熟练的使用它并将其应用到我们比较重交互的项目中，这样我们团队能够在之后的react项目中快速高效的创建和管理动画，以及提高产品表现力。他完成动画应用了大量物理学原理，包括但不限于质量、张力、摩擦力，它的目的是为了尽可能的将动画轨迹与真实世界更接近。

它没有定义的曲线或设定的持续时间，与我们习惯的动画有较大不同，我们曾一度从时间和曲线的角度来分析考虑动画，但我想这本身就是有违自然规律的，在现实世界中没有任何东西会像那样移动。

## 构成spring动画的基础

以下是其动画表现力不同模型的配置表

```
// For example
{
	mass: 1, 
	//质量-影响速度及过渡的效果，质量越高，动画停止所需的时间越长
	tension: 280, 
	// 张力-影响整体的速度，一般张力值越高，动画的收缩力会	更大，动画会显得	很有活力
	friction: 120 
	// 摩擦力-控制阻力及其减速的速度，摩擦力越高，动画越慢
	velocity: 0
	// 速度-动画的初始速度，比如可以设置一个负速度或者正速度为了更好的模拟自然
	clamp: false // 夹住 是否应该瞬间过渡，比如在不透明度动画时，透明度不可能低于0，这有助于保护你想要达到的效果
	xx: xxx 
}
```

spring给动画预置了几种常用的配置，比如柔和、摇晃、僵硬、缓慢。基本可以满足我们对动画的需求，以下的配置其实没有太大不同，主要就是调整摩擦力和张力，如果不满意，我们可以在config自由配置。

```
{
	 default: { mass: 1, tension: 170, friction: 26 },
   gentle: { mass: 1, tension: 120, friction: 14 }, //柔和
   wobbly: { mass: 1, tension: 180, friction: 12 },
   stiff: { mass: 1, tension: 210, friction: 20 },
	 slow: { mass: 1, tension: 280, friction: 60 },
   molasses: { mass: 1, tension: 280, friction: 120 }
}
```

此处还有较多的其他物理学属性配置，大家可以参考官网对参数的各项解释 [react-spring](https://react-spring.dev/common/configs#configs)
另外还可以参考[React-spring visualizer, tweak your spring configuration](https://react-spring-visualizer.com/)可视化的展现各种参数变化对动画带来的影响

接下来进入主题，我将为大家介绍常用的一些API。


## 常用HOOKS介绍
react-spring总共有五个hooks可以方便我们调用：**useChain、useSpring、useSprings、useTrail、useTransition**
我们下面一一来介绍一下。

### useSpring
创建一个单独的动画，宽高字体颜色背景等，可以在下方我创建了一个简单的沙盒进行调试，其接收一个包含动画属性的对象，或者返回值为对象的箭头函数。

* 参数： `props:() => (Props & Valid<Props, UseSpringProps<Props>>) | useSpringProps`
	* 传入一个箭头函数或者一个对象

* 返回值`springValues<PickAnimated<Props> | [springValues<State>,springRef<State>]`
	* 当传入的参数是对象的话，则返回一个AnimatedValue对象，如果是箭头函数的话，则返回一个数组，数组内部的第二个参数有很多方法可以调用。
[WardenSpringDemo - CodeSandbox](https://codesandbox.io/s/wardenspringdemo-fvfjrl?file=/src/App.js)

![1](/img/20220831/1.png)

![2](/img/20220831/2.gif)

### useSprings

创建一组同时执行的动画，注意，是同时执行每个动画，默认动画之间没有前后依赖关系

* 参数一： `length: number`
	* 需要创建动画的个数
* 参数二：`props: (i: number, ctrl: Controller) => Props | Props[] & UseSpringsProps<PickAnimated<Props>>[]` 
	* 一个数组或者一个箭头函数	
* 返回值`SpringValues<PickAnimated<Props>>[] | [SpringValues<State>[], SpringRefType<State>]`
	* 返回值和useSpring有点相似，但都变成了数组，如果返回数组的话，第二个参数 `SpringRef`，即下方`api` 里面可以调用很多方法， 比如`set() stop() start() pause() update()`等
 [WardenSpringsDemo - CodeSandbox](https://codesandbox.io/s/wardenspringsdemo-syy6pc?file=/src/App.js)
```
const springs = useSprings(
  number,
  items.map(item => ({ opacity: item.opacity }))
)
const [springs, api] = useSprings(number, index => ({ opacity: 1 }))
```

![3](/img/20220831/3.png)
![4](/img/20220831/4.gif)

### useTrail

 创建一组依次执行的动画。和上方的useSprings有点相似，不同点在于按顺序执行动画，而useSprings为同时执行
接收两个参数
* 参数一： `length: number`
	* 需要创建动画的个数
* 参数二：`props: (i: number, ctrl: Controller) => UseTrailProps | UseTrailProps`
	* 一个函数或者一个对象	
* 返回值与上述useSprings一致
[WardenTrailDemo - CodeSandbox](https://codesandbox.io/s/wardentraildemo-9ro188?file=/src/App.js)

![5](/img/20220831/5.png)


![6](/img/20220831/6.gif)

### useTransition

在组件加载或卸载等一些生命周期发生变化的时候执行动画
主要由这几个属性构成，可以在这些阶段给动画添加各式各样的属性动画
* 参数一： `data: OneOrMore<Item>`
	* 一般是控制组件卸载或者安装的那个值
* 参数二：`props: (i: number, ctrl: Controller) => UseTrailProps | UseTransitionProps<Item> | (Props & Valid<Props, UseTransitionProps<Item>>)`
	* 箭头函数或者对象
* 返回值为一个函数，该函数接受四个参数的回调，官方文档里写的是`the animated values, the item, the Transition object, and the sibling position`  这个我们在后续的使用过程中可以了解更多
[WardenTransitionDemo - CodeSandbox](https://codesandbox.io/s/wardentransitiondemo-47v6l7?file=/src/App.js)

![7](/img/20220831/7.png)
![8](/img/20220831/8.gif)

### useChain

设置一个动画按顺序在另一个动画之后执行，比如先执行spring动画，再执行transition动画。举个例子，我们在项目中遇到的一个checkbox，我将导出为SVG，其背景和打钩的动效可以依次先后执行
 * 参数一： `refs: ReadonlyArray<SpringRef>`
	* 一个包含很多动画引用的数组，一般就是各种ref 比如useSpringRef()之类的，在当前的V9版本针对useRef()做了一些包装。
* 参数二：`timeSteps?: number[]`
	* 介于0-1之间的数组，对应时间帧的开始和结束
* 参数三：`timeFrame?: number`
	* 不常用，没用过
* 返回值：无
[WardenCheckBoxDemo - CodeSandbox](https://codesandbox.io/s/wardencheckboxdemo-n9wjll)

![9](/img/20220831/9.png)

该例子中我们先定义了两个spring动画，然后使用useChain()依次执行，然后在下方的
`<animate.div>`中将其展现应用，具体该例子中涉及SVG的动画我们稍后再议。

![10](/img/20220831/10.png)

![11](/img/20220831/11.gif)

### 命令式调用方式

介绍完这几个常用的hooks之后，单独来说一说命令式调用方法。这是我们比较常用的一种调用方式，比如之前那些例子，如useSpring

![12](/img/20220831/12.png)

如果传入的参数是函数的话，那动画的属性变化只可以用set方法重新传入了。示例如下，是不是看起来和我们useState的方式差不多
[WardenImperativesDemo - CodeSandbox](https://codesandbox.io/s/wardenimperativesdemo-ulrxer?file=/src/App.js)

![13](/img/20220831/13.png)

![14](/img/20220831/14.gif)


### 插值的调用方式

这是一个强大的功能，如果有些样式有多个动态值，我们可以用插值进行分解，这样我们可以自由的设置更多的动态值，如下图，我们在移动到卡片上针对当前鼠标的位置动态计算卡片的rotateX、rotateY等，我们主要采用一个`to()`的方法来实现动画。

![15](/img/20220831/15.png)

![16](/img/20220831/16.gif)

![17](/img/20220831/17.gif)

### 有哪些样式可以用react-spring处理成动画？（参考官方文档）
* Colors (names, rgb, rgba, hsl, hsla, gradients)
* CSS Variables (declared on :root) and their fallbacks
* Absolute lengths (cm, mm, in, px, pt, pc)
* Relative lengths (em, ex, ch, rem, vw, vh, vmin, vmax, %)
* Angles (deg, rad, grad, turn)
* Flex and grid units (fr, etc)
* All HTML attributes
* SVG paths (as long as the number of points matches, otherwise use  [custom interpolation](https://codesandbox.io/embed/lwpkp46om) )
* Arrays
* String patterns (transform, border, boxShadow, etc)
* Non-animatable string values (visibility, pointerEvents, etc)
* ScrollTop/scrollLeft


## SVG与react-spring动画组合
当我们拿到视觉资源的时候，很多矢量图标我们通常导出为SVG的格式，在react开发过程中，我们可以将其SVG的不同模块进行拆分，我们可以针对路径或者填充等做一些比较有意思的小动画。当你给这些小模块加上`<nimated.xxx>`的时候，你就是这条街最靓的仔，想怎么动就怎么动。
在上述checkbox的案例中，中间的勾其实就是一个简单的path路径`d=“M3 7.10L7 11L13 4` 其描述了每个点的位置，
我们可以等待组件加载到之后，使用`ref.getTotalLength()`来获取这个路径的长度，然后通过 设置stroke-dasharray 的值为该长度，再用react-spring提供的各种hooks使stroke-dashoffset 从0运动到打勾路径的长度。

如果要再要细说此原理，属性 stroke-dasharray 他是一个控制虚线虚和实各有多长的属性，它接受一个数列，数与数之间用逗号或者空白隔开，指定短划线和缺口的长度。如果提供了奇数个值，则这个值的数列重复一次，从而变成偶数个值。比如，5,3,2等同于5,3,2,5,3,2。当设置为路径长度的时候，就刚刚好实线长度为这个勾。
Stroke-dashoffset 属性指定了 dash 模式到路径开始的距离，它接受一个百分比或者长度参数，当这个距离一直在改变的时候，会有一种这个勾在运动的感觉。[WardenCheckBoxDemo - CodeSandbox](https://codesandbox.io/s/wardencheckboxdemo-n9wjll)

如下：是从figma里导出的SVG模块中分离出来的path

![18](/img/20220831/18.png)


![19](/img/20220831/19.png)

总结步骤：
1.设置 stroke-dasharray 为path.getTotalLength()
2.animate stroke-dashoffset from path getTotalLength() to0

体验效果展示，这里在实际操作过程中还加了其他的动画hooks，协作完成
优化前：
![20](/img/20220831/20.png)
优化后：
![21](/img/20220831/21.gif)

再举个非常简单的小例子，可能是我们的举手之劳，但却可以带给用户愉悦、灵动的感觉。在日常开发过程中这种比较细小的点可能会比较多，视觉和交互不会特别提出来，但我觉得这是作为前端需要培养的能力，至少我们自己做的每件作品，你自己得得觉得它是好看的。当然这里又会涉及到我们产出及效率问题，我们需要在完成主逻辑之后的空余时间里做这些优化。

优化前：

![22](/img/20220831/22.gif)

优化后：

![23](/img/20220831/23.gif)

## react-spring更新原理简述
在`<animated.xxx>`组件上的style，实际上他返回的不是我们简单的一个css样式，而是一个 SpringValues 类型。react-spring 引用了**fluids**来作为观察者驱动 [GitHub - alloc/fluids: Glue layer for reactivity](https://github.com/alloc/fluids#readme)他会创建一个可观察值的树，让父节点向子节点发送任意事件（以获得最大的灵活性），我们可以在源码中找到addFluidObserver，removeFluidObserver等这些内容。
在addFluidObserver观察SpringValue的变化之后，再进行计算变更。关于如何计算更新，源码中有一个rafz库，专门来处理动画的更新，更新会产生一个队列 然后通过`shared.flushCalls(state.xxxQueue)`渲染到组件上

```
// 源码片段截取
function createSpring(key, observer) {
  const spring = new SpringValue();
  spring.key = key;
  if (observer) {
    shared.addFluidObserver(spring, observer);
  }
  return spring;
}
```

![24](/img/20220831/24.png)
![25](/img/20220831/25.png)

## 后记
动画始终是前端在日常开发中绕不过去的一环，细节处的小惊喜有助于加强用户的归属感和用户粘性，或许我们可以做得更多。

