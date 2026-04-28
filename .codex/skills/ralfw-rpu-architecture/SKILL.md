---
name: ralfw-rpu-architecture
description: Apply Ralf's RPU architecture guidance in this repository. Use when Codex is asked to design, review, explain, or evolve code according to RPU architecture, when the user mentions RPU, or when working on project structure and architectural boundaries for TripCal.
---

# RPU Architecture

## Overview

Use this local skill to keep TripCal architecture work aligned with Ralf's Request Processing Unit model.
Model each domain capability as an independent RPU that translates one domain request into one domain response and records application state as events.
Model each user interaction as a Slice that translates one user request into domain requests and composes RPUs and supporting modules into a useful flow.
Expose Slices to the UI only through a Processor facade located under `behavior/`.

## Workflow

1. Inspect the current TripCal repository structure before proposing or changing architecture.
2. Identify the user interaction being implemented and model it as one Slice.
3. Define the user request collected by the UI and the user response displayed by the UI.
4. Add or update the corresponding Processor function that accepts the user request and returns the user response.
5. Let the Processor delegate to the matching Slice; Processor functions and Slices correspond 1:1.
6. Let the Slice translate the user request into domain requests.
7. Identify each domain request and classify it as either a Command or a Query according to CQS.
8. Represent each domain capability as one RPU class with a fitting name and a `process()` function.
9. Keep RPUs independent from one another; do not let one RPU call or depend on another RPU.
10. Keep Slices free of their own business work; use them only to compose RPUs and supporting modules into the full interaction flow.
11. Treat the Event Store as the domain's natural state mechanism, not as an adapter, provider, or persistence concern to be specially designed.
12. Store durable application state only by appending events at the end of RPU processing.
13. Validate input at trust boundaries, usually in the Processor or at the latest in Slices.
14. Validate architecture changes with the smallest relevant checks available in the repository.

## Core Model

RPU means Request Processing Unit.

An RPU is the main building block of each application domain. It offers one domain service by translating a domain request into a domain response. All RPUs together define the domain of an application.

The domain is responsible for managing, evolving, and protecting application state. It does not depend on databases, persistence media, adapters, providers, or similar infrastructure concepts.

The Domain consists of the RPUs and the Event Store used for state.

Behavior consists of Slices and the RPUs they integrate.

An Application consists of the UI, Slices, and RPUs working together.

Each RPU:

- is represented by one class with a fitting name;
- exposes a `process()` function;
- processes exactly one kind of domain request;
- returns the corresponding domain response;
- is classified as either a Command processor or a Query processor;
- is independent from all other RPUs.

Place each RPU in its own folder with at least one class that implements it, so the implementation can grow without making the domain hard to navigate.

Domain requests follow CQS:

- A Command may change state and writes consequences as events to the Event Store.
- A Query does not change state and returns information derived from relevant events.

Name Command and Query RPUs with `Command` or `Query` as a suffix when the distinction is useful.

Command RPUs return status only: whether the command succeeded, and a reason when it failed. They may also return simple metadata, such as the ID of something created. They do not return rich result data.

Query RPUs return result data, such as selected or computed data. By definition, Queries do not fail with business errors. Invalid query input is a validation problem and should raise an exception. Event Store failures or other unexpected failures should also propagate as exceptions.

RPUs share only the Event Store. They read the events needed to build their local processing context. Command processors append new events that represent the consequences of the request.

The Event Store object is injected into RPU objects at runtime, but this is part of the definition of an RPU. Do not model this as a special architectural decision. For RPUs, using the Event Store is as natural and direct as using main memory.

RPUs may use main memory while processing a request. Durable application state, however, is stored exclusively as events in the Event Store at the end of processing.

RPUs do not use Providers.

## Event Store

The Event Store exposes only two operations:

- `append`: add one or more events.
- `query`: select events by event type and, when needed, by payload contents.

Do not introduce domain dependencies on database APIs, repositories, persistence providers, adapters, ORMs, or storage-specific abstractions when modeling RPUs.

For details about a concrete Event Store implementation, use the dedicated skill for that implementation. Keep this RPU architecture skill focused on architectural roles and boundaries.

Instantiate the concrete Event Store outside Processor, Slices, and RPUs. Inject it into the Processor, Slices, and RPUs. Use different Event Store implementations for production and tests.

## Events

Events are named in past tense. Follow the repository's event type casing convention; if none exists, prefer UpperCamelCase, for example `TripCreated`.

Events have this structure:

```ts
{
  eventType: string,
  payload: object
}
```

The payload is specific to the event type and always contains an event ID.

Example:

```ts
{
  eventType: "gameStarted",
  payload: {
    id: "123",
    players: ["Peter", "Mary"]
  }
}
```

The event ID is the ID of the event itself. Do not introduce entities, aggregates, aggregate IDs, aggregate repositories, or aggregate-centric modeling into this architecture.

When an initial event brings a new domain concept into existence, use that event's ID as the reference point for later events about the same concept. Do not create a separate entity ID or aggregate ID. Later events have their own event IDs and may reference the initial event ID explicitly.

Example:

```ts
{ eventType: "ContactSubmittedV1", payload: { id: "123", name: "Peter", email: "peter@web.de" } }
{ eventType: "ContactSubmittedV1", payload: { id: "987", name: "Paul", email: "paul@gmail.com" } }
{ eventType: "ContactDeletedV1", payload: { id: "738", contactSubmittedId: "123" } }
```

In this example, `123`, `987`, and `738` are event IDs. The deleted contact is identified by referring to the initial `ContactSubmittedV1` event ID `123`.

Model relationships through references between events. Do not model hidden CRUD records, entities, aggregates, or load-by-aggregate-ID behavior behind the event stream.

Events may carry any meaningful domain data in the payload. If a timestamp matters for the domain, put it in the payload.

Stored events have a sequence number that defines their order. Queries may use a sequence number as a starting point. Do not assume anything else about stored events beyond `eventType`, `payload`, and sequence ordering.

Version event types from the start. Prefer versioning in the `eventType`, for example `TripCreatedV1` and `TripCreatedV2`, so query selection stays explicit and does not depend on inspecting payload version fields.

## Requests and Responses

Keep user requests/responses and domain requests/responses separate.

Requests and responses are dumb data structures. Depending on the implementation language, represent them as records, interfaces, data classes, DTOs, structs, or similarly lightweight OO data structures.

Allow only marginal logic that belongs to the data structure itself, such as ADT-style operations. Keep them easy to test independently.

Name Slices and RPUs as imperatives or capabilities, for example `CreateTrip`. Name events as facts that already happened, for example `TripCreatedV1`.

## Example RPUs

For a Tic Tac Toe domain, possible RPUs include:

- `StartGameWithGivenPlayers`
- `RegisterMoveForPlayer`
- `EvaluateGameSituation`
- `GetGameState`
- `LetBotMakeMove`

## User Interface

Users interact with an application through a User Interface. A GUI is a User Interface, but so is a REST API controller when users send requests over HTTP instead of using keyboard or mouse input.

The UI is responsible for:

- collecting user input into user requests;
- triggering user requests, for example when a button is clicked or an HTTP request arrives;
- displaying user responses.

Collect and display are UI responsibilities. Do not let the UI process domain requests directly through RPUs.

The UI does not depend on Slices directly. It sends user requests to the Processor and receives user responses from the Processor.

## Processor

The Processor is its own module. It is only a helpful facade in front of the Slices that makes application behavior easy for the UI to access.

The Processor:

- exposes an interface to the frontend;
- accepts user requests from the UI;
- returns user responses to the UI;
- knows all Slices;
- has one function per Slice;
- delegates each user request to the corresponding Slice.

Processor functions correspond 1:1 with Slices. Do not treat the Processor as a separate domain or behavior layer. Do not put UI or frontend framework knowledge into the Processor.

Place the Processor under `behavior/`, for example `behavior/Processor.ts`. Do not create a separate `application/` directory or a separate `processor/` directory just for it.

## Slices

A Slice is the implementation of one user interaction with the application. Find Slices during requirements analysis by asking which interactions users want.

Each Slice:

- is implemented as its own class;
- handles one user request;
- produces one user response;
- translates user requests into domain requests;
- calls RPUs and functions from supporting modules;
- composes a process or data flow that realizes the full interaction behavior;
- may use non-domain modules such as database adapters or filesystem providers when the interaction needs them.

Place each Slice in its own folder with at least one class that implements it, so the code for that interaction can grow without making the behavior layer hard to navigate.

Slices do not perform business work themselves. Their job is only flow composition.

RPUs are raw application capabilities, like tools in a toolbox. Slices define the processes and flows in which those tools are used toward a user goal.

Do not put UI, frontend framework, database API, or other framework knowledge into Slices.

## Supporting Modules and Providers

Supporting modules complete application functionality outside the domain. Slices may call functions from supporting modules as part of a flow.

Providers encapsulate APIs and frameworks that are needed outside the domain, for example:

- reading data from a CSV file;
- sending email;
- calling an internet service;
- accessing the clock;
- accessing randomness;
- calling an AI service.

Treat time and randomness as resources that must be encapsulated behind Providers and injected, so tests can control them.

Providers are interfaces plus implementations. Fakes may live next to the provider or inside tests, depending on the codebase's test organization.

Providers do not know about the Event Store.

Do not let Processor, Slices, or RPUs depend directly on UI frameworks, REST frameworks, database APIs, or other external frameworks. Encapsulate these behind Providers or other supporting modules.

Supporting modules are modules where separating concerns is worthwhile. They may be classes, static modules, pure functions, or stateful helpers, depending on the concern.

## Construction and Dependency Injection

Use constructors for initialization and dependency injection.

Inject:

- the Event Store into RPUs, Slices, and the Processor;
- RPUs into Slices;
- Slices into the Processor;
- Providers and other mockable supporting modules where they are needed.

Instantiate concrete dependencies outside Processor, Slices, and RPUs. Use production implementations in production and fakes or mocks in tests.

## Folder Hierarchy

Use this default structure unless the repository already has a stronger local convention:

```txt
src/
  ui/
    rest/
    web/

  behavior/
    Processor.*
    slices/
      create-trip/
        CreateTrip.*

  domain/
    rpus/
      create-trip-command/
        CreateTripCommand.*
      get-trip-state-query/
        GetTripStateQuery.*
    events/
    event-store/

  providers/
    clock/
    randomness/
```

Do not create separate `application/` or `processor/` folders for the Processor.

Start with one domain. If needed, discuss sub-domains, but assume all RPUs write to the same Event Store. Use one Processor per domain.

## Testing

Test RPUs with a memory Event Store. Use the dedicated Event Store implementation skill for details.

Test Slices with fakes or mocks for Providers and other mockable dependencies as long as possible.

Keep Processor tests thin. Treat Processor tests as integration or acceptance tests over the application behavior.

Do not require UI tests for this architecture skill.

## Example Slices

For a Tic Tac Toe GUI, possible user interactions include:

- start a game with player names; if a player name is `"bot"`, let a bot move automatically;
- let a player make a move.

These interactions become two Slices. The domain may contain more RPUs than there are Slices because one Slice may coordinate several RPUs.

Example Slice flow for the interaction `PlayerMakesMove`:

1. Call RPU `RegisterMoveForPlayer`.
2. Call RPU `EvaluateGameSituation`.
3. Call RPU `GetGameState`.

This is the minimal flow before adding bot behavior.

## Open Architecture Inputs

Capture these before using the skill for implementation-heavy work:

- The expected top-level modules or folders.
- How requests, use cases, domain logic, persistence, and UI code should be assigned.
- Examples of one correct slice/module and one incorrect structure.

## Maintenance

Keep this skill short. Move longer confirmed RPU rules into `references/` only when they become too detailed for `SKILL.md`.
