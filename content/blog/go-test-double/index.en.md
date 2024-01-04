---
title: "Go Test Doubles by Example"
date: 2023-12-31T14:37:31+03:30
draft: false
description: "Test doubles serve as an alternative to real dependencies in testing. In this post, we'll review all test doubles using a real-world Go example."
tags:
- test double
- go
- fake
- spy
- mock
- stub
- dummy
- testing
categories:
- programming
cover:
    image: /blog/go-test-double/go-test-double.jpg
    caption: "Image Generated with [DALL.E 3](https://openai.com/dall-e-3)"
    alt: "test double in go."
---


## Introduction

When writing tests for a program, we often need to consider dependencies and external APIs that we prefer not to call every time the test runs. Calling these external dependencies not only adds complexity to our tests but also incurs costs. To address this issue, we can use test doubles.

## What Are Test Doubles?

Test doubles offer an alternative to real dependencies. While we commonly refer to all of them as mocks, there are various test doubles, each serving different purposes.

Let's briefly review each type of test double:

- **Fake**: Fakes are actual implementations of dependencies, in a simpler and chipper way. Consider a scenario where we have a database dependency. We can create a fake in-memory database that implements the database interface, allowing us to use it as a substitute for the actual database.
- **Dummy**: Dummies act as placeholder objects. We don't utilize their functionalities; instead, we pass parameters just to fulfill test requirements. We don't want to test their logic or behavior.
- **Mock**: Sometimes we want to test the behavior of our logic rather than the implementation or output. Mocks are for this purpose. For instance, ensuring a specific API called only once per request can be achieved by mocking that API.
- **Stub**: When testing particular logic, we might need to assess the program's state rather than its behavior. Stubs come into play by generating predefined responses for specific parameters.
- **Spy**: Spies, similar to stubs, offer dynamic behavior based on how they're invoked, providing a more interactive aspect. We can say that spies inherit from both stubs and mocks.

If you're unfamiliar with test doubles and want to read more about them, check the [resources](#further-reading) I've referenced at the end of the post.

## Test Doubles by an Example

Now that we've reviewed all test doubles, let's explain each of them using a real-world Go example.

Imagine we have a Payment service that depends on a payment gateway and contains a `ProcessPayment` method implementing logic when a user submits a payment. We want to write some test double for the payment package.

### Payment Gateway Dependency

First of all, let's define a simple implementation of an example gateway:

```go {linenos=true}
package gateway

import "errors"

type RealPaymentGateway struct{}

func (r *RealPaymentGateway) ProcessPayment(amount float64) error {
    if amount <= 0 {
        return errors.New("invalid payment amount")
    }
    return nil
}
```

### Payment Processor

Now, let's create a simple implementation of the `PaymentProcessor`. A `gateway` is as an input for this processor, and it includes a `Process` function that calls the `ProcessPayment` method of the gateway.

```go {linenos=true}
package payment

type PaymentGateway interface {
	ProcessPayment(amount float64) error
}

type PaymentProcessor struct {
	gateway PaymentGateway
}

func NewPaymentProcessor(gateway PaymentGateway) *PaymentProcessor {
	return &PaymentProcessor{
		gateway: gateway,
	}
}

func (p *PaymentProcessor) Process(amount float64) error {
	return p.gateway.ProcessPayment(amount)
}
```

Now, let's initialize our program with the `main` function:

```go {linenos=true}
package main

import (
	"fmt"

	"github.com/aminrashidbeigi/go-test-doubles/gateway"
	"github.com/aminrashidbeigi/go-test-doubles/payment"
)

func main() {
	realPaymentGateway := &gateway.RealPaymentGateway{} 
	paymentProcessor := payment.NewPaymentProcessor(realPaymentGateway)

	amount := 100.0

	err := paymentProcessor.Process(amount)
	if err != nil {
		fmt.Println("Payment failed:", err)
		return
	}

	fmt.Println("Payment processed successfully!")
}
```

When we run this program we get this output:

```txt
Payment processed successfully!
```

So, our program works well. Now, we've reached the fun part – writing tests!

### Test Doubles Implementations

#### Dummy

As I said, dummy just pass parameters to initialize a dependency and we don’t expect anything from them. In this example, the `PaymentGatewayDummy` satisfies the `PaymentGateway` interface by implementing the `ProcessPayment` method but does nothing inside the method. It's simply there to fulfill the requirement of a `PaymentGateway` object for the tests that rely on this interface.

```go {linenos=true}
type PaymentGatewayDummy struct{}

func (d *PaymentGatewayDummy) ProcessPayment(amount float64) error {
	return nil
}

func TestPaymentProcessor_WithDummy(t *testing.T) {
	paymentProcessor := payment.NewPaymentProcessor(&PaymentGatewayDummy{})

	err := paymentProcessor.Process(100.0)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
}
```

#### Fake

In the payment system example, the `PaymentGatewayFake` provides an alternative implementation with simpler logic. Here's the fake implementation:

```go {linenos=true}
type PaymentGatewayFake struct{}

func (f *PaymentGatewayFake) ProcessPayment(amount float64) error {
	if amount <= 0 {
		return errors.New("invalid amount")
	}
	return nil
}

func TestPaymentProcessor_WithFake(t *testing.T) {
	paymentProcessor := payment.NewPaymentProcessor(&PaymentGatewayFake{})

	err := paymentProcessor.Process(0)

	if err == nil {
		t.Error("Expected an error for zero amount, got none")
	}

	errNegative := paymentProcessor.Process(-10)

	if errNegative == nil {
		t.Error("Expected an error for negative amount, got none")
	}
}
```

#### Mock

Mocks are used to define and enforce expectations on interactions with an object. They specify certain method calls with specific parameters and help verify that these interactions occur as expected during tests. In this example, the mock records each call made to `ProcessPayment`, allowing later verification to ensure that the expected method calls happened in the specified order and with the correct parameters.

```go {linenos=true}
type PaymentGatewayMock struct {
	calls      []string
	callAmount float64
}

func (m *PaymentGatewayMock) ProcessPayment(amount float64) error {
	m.calls = append(m.calls, "ProcessPayment")
	m.callAmount = amount

	return nil
}

func (m *PaymentGatewayMock) VerifyCalls(expectedCalls []string) bool {
	if len(expectedCalls) != len(m.calls) {
		return false
	}
	for i, call := range expectedCalls {
		if call != m.calls[i] {
			return false
		}
	}
	return true
}

func TestPaymentProcessor_WithMock(t *testing.T) {
	paymentGatewayMock := &PaymentGatewayMock{}
	paymentProcessor := payment.NewPaymentProcessor(paymentGatewayMock)

	amount := 75.0
	_ = paymentProcessor.Process(amount)

	expectedCalls := []string{"ProcessPayment"}
	if !paymentGatewayMock.VerifyCalls(expectedCalls) {
		t.Errorf("Expected calls %v, got %v", expectedCalls, paymentGatewayMock.calls)
	}
	if paymentGatewayMock.callAmount != amount {
		t.Errorf("Expected call amount %f, got %f", amount, paymentGatewayMock.callAmount)
	}
}
```

#### Stub

The stub here represents a simplified version of the `PaymentGateway`. It has a `success` boolean field that determines whether the payment should be successful or fail. The `ProcessPayment` method of the stub checks the `success` field and returns an error if `success` is set to `false`, simulating a failed payment.

```go {linenos=true}
type PaymentGatewayStub struct {
	success bool
}

func (s *PaymentGatewayStub) ProcessPayment(amount float64) error {
	if !s.success {
		return errors.New("payment failed")
	}
	return nil
}

func TestPaymentProcessor_WithStub_SuccessfulPayment(t *testing.T) {
	paymentProcessor := payment.NewPaymentProcessor(&PaymentGatewayStub{success: true})

	err := paymentProcessor.Process(100.0)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
}

func TestPaymentProcessor_WithStub_FailedPayment(t *testing.T) {
	paymentProcessor := payment.NewPaymentProcessor(&PaymentGatewayStub{success: false})

	err := paymentProcessor.Process(50.0)

	if err == nil {
		t.Error("Expected an error, got none")
	}
}
```

#### Spy

The spy here is used to track and record information about interactions with the `PaymentGateway`. It has `called` and `amount` fields to record whether the `ProcessPayment` method has been called and the amount passed to it. During testing, the spy captures and records this information, allowing tests to assert whether certain interactions have occurred.

```go {linenos=true}
type PaymentGatewaySpy struct {
	called bool
	amount float64
}

func (s *PaymentGatewaySpy) ProcessPayment(amount float64) error {
	s.called = true
	s.amount = amount
	return nil
}

func TestPaymentProcessor_WithSpy(t *testing.T) {
	paymentGatewaySpy := &PaymentGatewaySpy{}
	paymentProcessor := payment.NewPaymentProcessor(paymentGatewaySpy)

	amount := 75.0
	_ = paymentProcessor.Process(amount)

	if !paymentGatewaySpy.called {
		t.Error("Expected PaymentGatewaySpy to be called")
	}
	if paymentGatewaySpy.amount != amount {
		t.Errorf("Expected amount %f, got %f", amount, paymentGatewaySpy.amount)
	}
}
```

## Wrapping up

Each type of test double—dummies, stubs, spies, mocks, and fakes—has its unique role in testing of our code. They help us check if our code works correctly, create specific situations for testing, and make sure our tests happen in a safe space with reduced complexity and cost.

I've placed all this code in a GitHub repository. You can check it here: [Go Test Double](https://github.com/aminrashidbeigi/go-test-double).

## Further Reading

- [TestDouble](https://martinfowler.com/bliki/TestDouble.html) - Martin Fowler
- [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html) - Martin Fowler
- [Test Double](http://xunitpatterns.com/Test%20Double.html) - XUnitPatterns
