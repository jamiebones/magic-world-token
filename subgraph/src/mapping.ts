import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import {
    OrderCreated,
    OrderFilled,
    OrderCancelled,
    OrderExpired,
    WithdrawalClaimed,
    MWGOrderBook,
} from '../generated/MWGOrderBook/MWGOrderBook'
import { Order, OrderFill, OrderCancellation, Withdrawal } from '../generated/schema'

export function handleOrderCreated(event: OrderCreated): void {
    const id = event.params.orderId.toString()
    let order = new Order(id)

    // Read feeAtCreation from contract storage (not included in event params)
    const contract = MWGOrderBook.bind(event.address)
    const onChainOrder = contract.orders(event.params.orderId)
    // graph-ts codegen uses positional accessors: feeAtCreation is the 12th output field (index 11)
    const feeAtCreation = onChainOrder.value11

    order.orderId = event.params.orderId
    order.user = event.params.user
    order.orderType = event.params.orderType
    order.mwgAmount = event.params.mwgAmount
    order.bnbAmount = event.params.bnbAmount
    order.pricePerMWG = event.params.price
    order.filled = BigInt.fromI32(0)
    order.remaining = event.params.mwgAmount
    order.status = 0 // ACTIVE
    order.feeAtCreation = feeAtCreation
    order.txHash = event.transaction.hash
    order.blockNumber = event.block.number
    order.createdAt = event.block.timestamp
    order.expiresAt = event.params.expiresAt

    order.save()
}

export function handleOrderFilled(event: OrderFilled): void {
    // Update the Order entity
    const orderId = event.params.orderId.toString()
    let order = Order.load(orderId)

    if (order != null) {
        const newFilled = order.filled.plus(event.params.mwgAmount)
        order.filled = newFilled
        order.remaining = order.mwgAmount.minus(newFilled)
        order.status = event.params.newStatus
        order.save()
    }

    // Create OrderFill entity
    const fillId = event.params.orderId.toString() + '-' + event.params.fillId.toString()
    let fill = new OrderFill(fillId)

    fill.orderId = event.params.orderId
    fill.order = orderId
    fill.fillId = event.params.fillId
    fill.filler = event.params.filler
    fill.mwgAmount = event.params.mwgAmount
    fill.bnbAmount = event.params.bnbAmount
    fill.newStatus = event.params.newStatus
    fill.txHash = event.transaction.hash
    fill.blockNumber = event.block.number
    fill.timestamp = event.block.timestamp

    fill.save()
}

export function handleOrderCancelled(event: OrderCancelled): void {
    // Update Order status
    const orderId = event.params.orderId.toString()
    let order = Order.load(orderId)

    if (order != null) {
        order.status = 3 // CANCELLED
        order.save()
    }

    // Create cancellation record
    let cancellation = new OrderCancellation(orderId)
    cancellation.orderId = event.params.orderId
    cancellation.user = event.params.user
    cancellation.bnbRefund = event.params.bnbRefund
    cancellation.mwgRefund = event.params.mwgRefund
    cancellation.txHash = event.transaction.hash
    cancellation.blockNumber = event.block.number
    cancellation.timestamp = event.block.timestamp

    cancellation.save()
}

export function handleOrderExpired(event: OrderExpired): void {
    const orderId = event.params.orderId.toString()
    let order = Order.load(orderId)

    if (order != null) {
        order.status = 4 // EXPIRED
        order.save()
    }
}

export function handleWithdrawalClaimed(event: WithdrawalClaimed): void {
    const id = event.params.user.toHexString() + '-' + event.transaction.hash.toHexString()
    let withdrawal = new Withdrawal(id)

    withdrawal.user = event.params.user
    withdrawal.amount = event.params.amount
    withdrawal.txHash = event.transaction.hash
    withdrawal.blockNumber = event.block.number
    withdrawal.timestamp = event.block.timestamp

    withdrawal.save()
}