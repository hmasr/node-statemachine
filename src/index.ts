'use strict'

interface IStateNode {
  name: string
}

type StateAction = Function | StateTransition

interface IStateMachineDescription {
  [key: string]: Object | string | StateAction
}

class StateTransition {
  public stateName: string
  public operation: Function

  constructor(stateName: string, fn: Function) {
    this.stateName = stateName
    this.operation = fn
  }

  public transition(scope: StateMachine) {
    scope.setState(this.stateName)
  }
}

class StateTrigger implements IStateNode {
  public name: string
  private _action: StateAction

  constructor(name: string, action: StateAction) {
    this.name = name
    this._action = action
  }

  public call(stateMachine: StateMachine, ...args: any[]) {
    let returnValue: any
    args.unshift({ scope: stateMachine })
    if (this._action instanceof StateTransition) {
      returnValue = this._action.operation.apply(this, args)
      this._action.transition(stateMachine)
    } else {
      returnValue = this._action.apply(this, args)
    }

    return returnValue
  }
}

class State implements IStateNode {
  public name: string
  public triggers: StateTrigger[] = []

  constructor(name: string, triggersDescription: object) {
    this.name = name
    const triggers = Object.entries(triggersDescription)
    for (const [triggerName, triggerAction] of triggers) {
      this.triggers.push(new StateTrigger(triggerName, triggerAction))
    }
  }

  public getEventNames(): string[] {
    return this.triggers.map((event: StateTrigger) => event.name)
  }
}

class StateMachine {
  static STATES: string = 'states'
  static STARTING_STATE: string = 'starting-state'

  public previousStateName: string | undefined
  public stateName: string | undefined
  private states: Map<string, State>

  [key: string]: any

  constructor(description: IStateMachineDescription) {
    const startingStateName: string = description[StateMachine.STARTING_STATE] as string
    const RESERVED: string[] = [StateMachine.STARTING_STATE, StateMachine.STATES]
    const propertiesAndMethods = Object.keys(description).filter(
      property => !RESERVED.includes(property)
    )
    for (const property of propertiesAndMethods) {
      this[property] = description[property] as Object
    }

    this.states = new Map<string, State>()
    const _states = Object.entries(description[StateMachine.STATES])
    for (const [stateName, triggers] of _states) {
      this.states.set(stateName, new State(stateName, triggers as Object))
    }

    this.setState(startingStateName)
  }

  public getState(): State | undefined {
    return this.stateName === undefined ? undefined : this.states!.get(this.stateName)
  }

  public getEventNames(): string[] {
    const state = this.getState()
    return state === undefined ? [] : state!.getEventNames()
  }

  public getAllStatesNames(): string[] {
    return [...this.states.keys()]
  }

  public setState(stateName: string): void {
    const currentState = this.getState()
    if (currentState) {
      for (const { name } of currentState.triggers) {
        if (typeof this.__proto__[name] === 'function') {
          delete this.__proto__[name]
        }
      }
    }

    // Set the new state
    this.previousStateName = this.stateName
    this.stateName = stateName

    const state = this.getState()!
    for (const event of state.triggers) {
      this.__proto__[event.name] = function(...args: any[]) {
        event.call(this, ...args)
      }
    }
  }
}

export { StateMachine, StateTransition, IStateMachineDescription }
