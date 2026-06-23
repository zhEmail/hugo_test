---
title: "从中后台到平台化：前端架构的稳定性设计"
date: 2026-06-23T10:00:00+08:00
draft: false
author: "张晗"
categories: ["前端架构"]
tags: ["前端工程化", "微前端", "可观测性", "性能优化"]
summary: "一篇偏架构视角的复盘：如何把中后台从页面堆叠，演进成可治理、可观测、可持续交付的平台。"
---

前端架构真正难的地方，不是把项目拆成多少个包，也不是选 React 还是 Vue，而是当业务持续增长、团队持续扩张、页面数量从几十个变成几百个时，系统依然能稳定演进。

我通常把中后台前端拆成四层来看：应用层、领域层、基础设施层和治理层。前两层解决业务表达，后两层决定系统能不能长期活下去。

## 一、应用层：让页面只表达流程

页面组件最容易失控。一个列表页里同时出现路由解析、权限判断、接口编排、表格状态、弹窗状态、埋点、异常处理，三个月后它就会变成没人敢动的文件。

更稳定的做法是让页面只负责三件事：

- 组织布局
- 连接领域能力
- 呈现交互状态

例如一个订单详情页，不应该直接理解所有接口细节，而是调用 `useOrderDetail`、`useOrderActions`、`useOrderPermission` 这类领域 hook。这样页面看起来像业务流程，复杂性被压到更合适的位置。

```ts
export function OrderDetailPage() {
  const { order, loading, refresh } = useOrderDetail()
  const { canRefund, canExport } = useOrderPermission(order)
  const actions = useOrderActions({ order, onSuccess: refresh })

  if (loading) return <OrderSkeleton />

  return (
    <OrderLayout
      detail={<OrderBaseInfo order={order} />}
      timeline={<OrderTimeline orderId={order.id} />}
      actions={<OrderToolbar canRefund={canRefund} canExport={canExport} actions={actions} />}
    />
  )
}
```

这类代码的目标不是炫技，而是让后续维护者能一眼判断：“页面在编排，领域在决策，组件在展示。”

## 二、领域层：别让接口模型污染 UI

很多项目的隐性债务来自接口模型直接进入组件。后端返回什么，前端就传什么；字段名变了，一路影响到表格、表单、导出、权限。

领域层应该做一次转换，把服务端模型变成前端真正需要的视图模型。

```ts
type OrderDTO = {
  order_no: string
  pay_status: 0 | 1 | 2
  amount_cent: number
}

type OrderView = {
  orderNo: string
  statusText: string
  amountText: string
}

export function normalizeOrder(dto: OrderDTO): OrderView {
  return {
    orderNo: dto.order_no,
    statusText: payStatusMap[dto.pay_status],
    amountText: `￥${(dto.amount_cent / 100).toFixed(2)}`,
  }
}
```

这个转换层看起来简单，但它让前端拥有自己的稳定边界。接口变化时，影响被限制在 adapter，而不是扩散到整个组件树。

## 三、基础设施层：把重复问题产品化

中后台常见能力高度重复：

- 请求封装
- 鉴权和权限控制
- 表格查询状态
- 表单联动
- 错误提示
- 国际化
- 主题切换
- 埋点和监控

如果每个业务线都各写一套，系统会很快碎片化。我的经验是：只要一个能力在三个以上页面出现，就应该考虑沉淀成基础设施；只要三个以上项目都需要，就应该进入平台层或组件库。

例如表格查询可以沉淀为 `useQueryTable`：

```ts
const table = useQueryTable({
  queryKey: ['orders'],
  fetcher: orderApi.search,
  defaultParams: {
    pageSize: 20,
    status: 'all',
  },
})
```

它不只是少写代码，更关键的是把分页、筛选、缓存、URL 同步、异常重试这些行为统一起来。统一之后，团队才能讨论治理，否则只能讨论每个页面的“个人风格”。

## 四、治理层：架构要能被度量

架构如果不能被度量，就很容易变成口号。前端至少应该观测四类指标：

| 指标 | 关注点 | 常用手段 |
| --- | --- | --- |
| 构建指标 | 构建耗时、产物体积、依赖变化 | CI 日志、bundle analyzer |
| 运行指标 | LCP、INP、CLS、JS 错误率 | Web Vitals、前端监控 SDK |
| 交付指标 | 发布频率、回滚次数、失败率 | CI/CD 平台 |
| 质量指标 | 测试覆盖、重复代码、类型覆盖 | Vitest、Playwright、ESLint、TypeScript |

我比较喜欢把这些指标放进 PR 或发布流水线里，而不是只放到周报里。因为治理最有效的时机，是问题刚进入系统的时候。

## 五、架构决策的取舍

前端架构不是“越复杂越专业”。我会用三个问题判断要不要引入新方案：

1. 它解决的是当前真实问题，还是未来想象中的问题？
2. 它会让业务开发更快，还是只让架构图更漂亮？
3. 如果核心维护者离开，团队是否还能理解和继续演进？

比如微前端不是银弹。如果团队只有一个前端小组，业务边界还不稳定，过早微前端会把简单问题变成部署、通信、样式隔离和依赖共享问题。反过来，如果多个团队独立发布、技术栈并存、权限和菜单统一，这时微前端才可能真正创造价值。

## 总结

我理解的前端架构，是把复杂度放在合适的位置：

- 页面表达流程
- 领域封装规则
- 基建统一重复能力
- 治理体系持续度量

最终目标不是“看起来很架构”，而是让系统在业务增长之后仍然能改、能测、能发布、能定位问题。

## 参考资料

- [web.dev: Core Web Vitals](https://web.dev/articles/vitals)
- [React Documentation: Suspense](https://react.dev/reference/react/Suspense)
- [Vue Documentation: Performance](https://vuejs.org/guide/best-practices/performance.html)
- [Vercel Blog](https://vercel.com/blog)
