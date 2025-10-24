(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-BATCH-ID u101)
(define-constant ERR-INVALID-QUANTITY u102)
(define-constant ERR-INVALID-DATE u103)
(define-constant ERR-INVALID-HASH u104)
(define-constant ERR-INVALID-MANUFACTURER u105)
(define-constant ERR-BATCH-ALREADY-EXISTS u106)
(define-constant ERR-BATCH-NOT-FOUND u107)
(define-constant ERR-INVALID-METADATA u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-STATUS u110)
(define-constant ERR-INVALID-LOCATION u111)
(define-constant ERR-INVALID-TEMPERATURE u112)
(define-constant ERR-MAX-BATCHES-EXCEEDED u113)
(define-constant ERR-INVALID-UPDATE-PARAM u114)

(define-data-var next-batch-id uint u0)
(define-data-var max-batches uint u10000)
(define-data-var authority-contract (optional principal) none)
(define-data-var registration-fee uint u500)

(define-map batches
  uint
  {
    batch-id: (string-utf8 100),
    manufacturer: principal,
    quantity: uint,
    production-date: uint,
    expiration-date: uint,
    composition-hash: (buff 32),
    metadata: (string-utf8 256),
    status: (string-utf8 20),
    origin-location: (string-utf8 100),
    storage-temperature: int,
    timestamp: uint
  }
)

(define-map batches-by-id
  (string-utf8 100)
  uint)

(define-map batch-updates
  uint
  {
    update-metadata: (string-utf8 256),
    update-status: (string-utf8 20),
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-batch (id uint))
  (map-get? batches id)
)

(define-read-only (get-batch-updates (id uint))
  (map-get? batch-updates id)
)

(define-read-only (is-batch-registered (batch-id (string-utf8 100)))
  (is-some (map-get? batches-by-id batch-id))
)

(define-private (validate-batch-id (batch-id (string-utf8 100)))
  (if (and (> (len batch-id) u0) (<= (len batch-id) u100))
      (ok true)
      (err ERR-INVALID-BATCH-ID))
)

(define-private (validate-quantity (quantity uint))
  (if (> quantity u0)
      (ok true)
      (err ERR-INVALID-QUANTITY))
)

(define-private (validate-date (date uint))
  (if (>= date block-height)
      (ok true)
      (err ERR-INVALID-DATE))
)

(define-private (validate-hash (hash (buff 32)))
  (if (> (len hash) u0)
      (ok true)
      (err ERR-INVALID-HASH))
)

(define-private (validate-manufacturer (manufacturer principal))
  (if (not (is-eq manufacturer 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-INVALID-MANUFACTURER))
)

(define-private (validate-metadata (metadata (string-utf8 256)))
  (if (<= (len metadata) u256)
      (ok true)
      (err ERR-INVALID-METADATA))
)

(define-private (validate-status (status (string-utf8 20)))
  (if (or (is-eq status u"active") (is-eq status u"recalled") (is-eq status u"expired"))
      (ok true)
      (err ERR-INVALID-STATUS))
)

(define-private (validate-location (location (string-utf8 100)))
  (if (and (> (len location) u0) (<= (len location) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-temperature (temp int))
  (if (and (>= temp -20) (<= temp 40))
      (ok true)
      (err ERR-INVALID-TEMPERATURE))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-manufacturer contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-registration-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set registration-fee new-fee)
    (ok true)
  )
)

(define-public (register-batch
  (batch-id (string-utf8 100))
  (quantity uint)
  (production-date uint)
  (expiration-date uint)
  (composition-hash (buff 32))
  (metadata (string-utf8 256))
  (status (string-utf8 20))
  (origin-location (string-utf8 100))
  (storage-temperature int)
)
  (let (
        (next-id (var-get next-batch-id))
        (current-max (var-get max-batches))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-BATCHES-EXCEEDED))
    (try! (validate-batch-id batch-id))
    (try! (validate-quantity quantity))
    (try! (validate-date production-date))
    (try! (validate-date expiration-date))
    (try! (validate-hash composition-hash))
    (try! (validate-metadata metadata))
    (try! (validate-status status))
    (try! (validate-location origin-location))
    (try! (validate-temperature storage-temperature))
    (asserts! (is-none (map-get? batches-by-id batch-id)) (err ERR-BATCH-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get registration-fee) tx-sender authority-recipient))
    )
    (map-set batches next-id
      {
        batch-id: batch-id,
        manufacturer: tx-sender,
        quantity: quantity,
        production-date: production-date,
        expiration-date: expiration-date,
        composition-hash: composition-hash,
        metadata: metadata,
        status: status,
        origin-location: origin-location,
        storage-temperature: storage-temperature,
        timestamp: block-height
      }
    )
    (map-set batches-by-id batch-id next-id)
    (var-set next-batch-id (+ next-id u1))
    (print { event: "batch-registered", id: next-id })
    (ok next-id)
  )
)

(define-public (update-batch
  (batch-id uint)
  (new-metadata (string-utf8 256))
  (new-status (string-utf8 20))
)
  (let ((batch (map-get? batches batch-id)))
    (match batch
      b
        (begin
          (asserts! (is-eq (get manufacturer b) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-metadata new-metadata))
          (try! (validate-status new-status))
          (map-set batches batch-id
            {
              batch-id: (get batch-id b),
              manufacturer: (get manufacturer b),
              quantity: (get quantity b),
              production-date: (get production-date b),
              expiration-date: (get expiration-date b),
              composition-hash: (get composition-hash b),
              metadata: new-metadata,
              status: new-status,
              origin-location: (get origin-location b),
              storage-temperature: (get storage-temperature b),
              timestamp: block-height
            }
          )
          (map-set batch-updates batch-id
            {
              update-metadata: new-metadata,
              update-status: new-status,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "batch-updated", id: batch-id })
          (ok true)
        )
      (err ERR-BATCH-NOT-FOUND)
    )
  )
)

(define-public (get-batch-count)
  (ok (var-get next-batch-id))
)